import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Keypair, StrKey } from 'stellar-sdk';
import { SupabaseService } from '../../database/supabase.client';
import { UsersRepository, UploadedAvatarFile } from '../../database/repositories/users.repository';
import { NonceResponseDto } from './dto/nonce-response.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import {
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_EXPIRATION_SECONDS,
  REFRESH_TOKEN_EXPIRATION,
  REFRESH_TOKEN_EXPIRATION_MS,
} from '../../config/jwt.config';
import { AuditService } from '../admin/audit.service';

const NONCE_EXPIRATION_SECONDS = 300;

interface RefreshTokenPayload {
  type?: string;
  wallet?: string;
  fam?: string;
}

export interface RegisterResponse extends AuthResponseDto {
  user: {
    id: string;
    walletAddress: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterRequestDto, profileImage?: UploadedAvatarFile): Promise<RegisterResponse> {
    let avatarUrl: string | null = null;
    let createdUserId: string | null = null;
    try {
      if (profileImage) {
        avatarUrl = await this.usersRepository.uploadAvatar(dto.walletAddress, profileImage);
      }
      const user = await this.usersRepository.createProfile({
        wallet: dto.walletAddress,
        username: dto.username,
        displayName: dto.displayName,
        avatarUrl,
      });
      createdUserId = user.id;

      const tokens = await this.generateTokens(dto.walletAddress);

      return {
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          createdAt: user.created_at,
        },
        ...tokens,
      };
    } catch (error) {
      if (avatarUrl) {
        await this.usersRepository.deleteAvatar(avatarUrl).catch(() => {});
      }
      if (createdUserId) {
        await this.usersRepository.deleteUserById(createdUserId).catch(() => {});
      }
      throw error;
    }
  }

  async generateNonce(wallet: string): Promise<NonceResponseDto> {
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + NONCE_EXPIRATION_SECONDS * 1000);
    const client = this.supabaseService.getServiceRoleClient();
    const { error } = await client.from('nonces').insert({
      wallet_address: wallet,
      nonce,
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      throw new InternalServerErrorException({ code: 'DATABASE_NONCE_INSERT_FAILED', message: 'Failed to generate nonce.' });
    }
    return { nonce, expiresAt: expiresAt.toISOString() };
  }

  async verifySignature(dto: VerifyRequestDto): Promise<void> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data: nonceRecord, error: nonceError } = await client
      .from('nonces')
      .select('id, expires_at')
      .eq('wallet_address', dto.wallet)
      .eq('nonce', dto.nonce)
      .is('used_at', null)
      .single();
    if (nonceError || !nonceRecord) {
      throw new UnauthorizedException({ code: 'AUTH_NONCE_NOT_FOUND', message: 'Nonce not found or already used.' });
    }

    // Atomic nonce claim: consume the row BEFORE expensive signature verification.
    // The conditional UPDATE ... WHERE id = ? AND used_at IS NULL is a single
    // atomic statement in Postgres. Two concurrent verify requests that both
    // observed the same unused row above will race here; only one UPDATE will
    // affect a row (count === 1). The loser gets count === 0 / empty data and
    // is rejected as already consumed. This eliminates the TOCTOU window that
    // previously existed between the SELECT and the trailing UPDATE.
    //
    // SECURITY TRADEOFF: if signature verification subsequently fails (or the
    // nonce is expired), the nonce stays burned. Callers must request a fresh
    // nonce and re-sign. This converts a replay of a stolen nonce+signature
    // into a DoS-on-self (one wasted challenge) which is the correct tradeoff
    // versus allowing unlimited session creation from a single intercepted pair.
    const claimedAt = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase builder count typings for update().select() chain are incomplete; need runtime count check
    const claimResult: any = await (client.from('nonces') as any)
      .update({ used_at: claimedAt }, { count: 'exact' })
      .eq('id', (nonceRecord as { id: string }).id)
      .is('used_at', null)
      .select('id');
    const claimError = claimResult?.error as { message: string } | null | undefined;
    const claimData = claimResult?.data as unknown[] | null | undefined;
    const claimCount = claimResult?.count as number | null | undefined;
    if (claimError) {
      throw new InternalServerErrorException({
        code: 'DATABASE_NONCE_CLAIM_FAILED',
        message: 'Failed to claim nonce.',
      });
    }
    const claimedCount = typeof claimCount === 'number' ? claimCount : (claimData?.length ?? 0);
    if (claimedCount === 0) {
      throw new UnauthorizedException({ code: 'AUTH_NONCE_NOT_FOUND', message: 'Nonce not found or already used.' });
    }

    // Nonce is now burned regardless of outcome below. Check expiry AFTER the
    // claim so an expired row is still consumed and cannot be retried.
    if (new Date((nonceRecord as { expires_at: string }).expires_at) < new Date()) {
      throw new UnauthorizedException({ code: 'AUTH_NONCE_EXPIRED', message: 'Nonce has expired.' });
    }

    if (!StrKey.isValidEd25519PublicKey(dto.wallet)) {
      throw new UnauthorizedException({ code: 'AUTH_SIGNATURE_INVALID', message: 'Invalid signature.' });
    }
    try {
      const keypair = Keypair.fromPublicKey(dto.wallet);

      let isValid = false;

      // First attempt: raw Ed25519 signature (mobile clients)
      try {
        isValid = keypair.verify(Buffer.from(dto.nonce), Buffer.from(dto.signature, 'base64'));
      } catch {
        isValid = false;
      }

      // If raw verification failed, try SEP-0043 (browser wallets like Freighter)
      if (!isValid) {
        try {
          const sepMessage = 'Stellar Signing Key: ' + dto.nonce;
          isValid = keypair.verify(Buffer.from(sepMessage), Buffer.from(dto.signature, 'base64'));
        } catch {
          isValid = false;
        }
      }

      if (!isValid) {
        throw new UnauthorizedException({ code: 'AUTH_SIGNATURE_INVALID', message: 'Invalid signature.' });
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({ code: 'AUTH_SIGNATURE_INVALID', message: 'Invalid signature.' });
    }
  }

  private async findOrCreateUser(wallet: string): Promise<{ id: string; role: string | null }> {
    const client = this.supabaseService.getServiceRoleClient();
    const { data: user, error } = await client
      .from('users')
      .upsert({ wallet_address: wallet, last_seen_at: new Date().toISOString() }, { onConflict: 'wallet_address' })
      .select('id, status, role')
      .single();
    if (error || !user) {
      throw new InternalServerErrorException({ code: 'DATABASE_USER_UPSERT_FAILED', message: 'Failed to create or update user.' });
    }
    if (user.status === 'blocked') {
      throw new UnauthorizedException({ code: 'AUTH_USER_BLOCKED', message: 'This account has been suspended.' });
    }
    const { data: profile } = await client
      .from('learner_profiles')
      .select('id')
      .eq('wallet_address', wallet)
      .maybeSingle();
    if (!profile) {
      await client.from('learner_profiles').insert({
        wallet_address: wallet,
      });
    }
    return { id: user.id, role: user.role ?? null };
  }

  async generateTokens(wallet: string, familyId?: string): Promise<AuthResponseDto> {
    const { id: userId, role } = await this.findOrCreateUser(wallet);
    const client = this.supabaseService.getServiceRoleClient();
    // Role is read fresh from the users table on every token generation,
    // so POST /auth/refresh naturally mints a token with the latest role.
    const accessToken = this.jwtService.sign(
      { wallet, type: 'access', role },
      { secret: this.configService.get<string>('JWT_SECRET'), expiresIn: ACCESS_TOKEN_EXPIRATION },
    );
    // All tokens minted from one login (or any of its refreshes) share a
    // family id, enabling theft containment when a rotated token is replayed.
    const sessionFamilyId = familyId ?? randomUUID();
    const refreshToken = this.jwtService.sign(
      { wallet, type: 'refresh', fam: sessionFamilyId },
      { secret: this.configService.get<string>('JWT_REFRESH_SECRET'), expiresIn: REFRESH_TOKEN_EXPIRATION },
    );
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_MS);
    const { error: sessionError } = await client.from('sessions').insert({
      user_id: userId,
      refresh_token_hash: refreshTokenHash,
      family_id: sessionFamilyId,
      expires_at: refreshExpiresAt.toISOString(),
    });
    if (sessionError) {
      throw new InternalServerErrorException({ code: 'DATABASE_SESSION_CREATE_FAILED', message: 'Failed to create session.' });
    }
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_EXPIRATION_SECONDS, tokenType: 'Bearer' };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({ code: 'AUTH_REFRESH_TOKEN_INVALID', message: 'Refresh token is invalid or expired.' });
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({ code: 'AUTH_REFRESH_TOKEN_INVALID', message: 'Invalid token type.' });
    }
    const client = this.supabaseService.getServiceRoleClient();
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const { data: session, error } = await client
      .from('sessions')
      .select('id, family_id, expires_at')
      .eq('refresh_token_hash', tokenHash)
      .single();
    if (error || !session) {
      await this.handleRefreshReplay(payload);
      // Tokens minted before session families existed fall back to the
      // original error so legacy clients see a stable response shape.
      if (payload.fam) {
        throw new UnauthorizedException({
          code: 'AUTH_REFRESH_TOKEN_REUSED',
          message: 'Refresh token reuse detected. All sessions have been revoked. Please sign in again.',
        });
      }
      throw new UnauthorizedException({ code: 'AUTH_SESSION_NOT_FOUND', message: 'Session not found. Please sign in again.' });
    }
    if (new Date(session.expires_at) < new Date()) {
      throw new UnauthorizedException({ code: 'AUTH_SESSION_EXPIRED', message: 'Session expired. Please sign in again.' });
    }
    await client.from('sessions').delete().eq('id', session.id);
    return this.generateTokens(payload.wallet as string, session.family_id);
  }

  /**
   * A validly-signed refresh token whose session row no longer exists means
   * the token was already rotated — i.e. it is being replayed, most likely
   * by an attacker who stole it. Contain the compromise by revoking every
   * session in the family and recording a security audit event.
   */
  private async handleRefreshReplay(payload: RefreshTokenPayload): Promise<void> {
    const familyId = payload.fam;
    const wallet = payload.wallet ?? 'unknown';
    this.logger.error(`Refresh token replay detected for wallet ${wallet}${familyId ? ` (family ${familyId})` : ''}`);
    if (!familyId) {
      // Legacy token minted before families existed — nothing to revoke.
      return;
    }
    const client = this.supabaseService.getServiceRoleClient();
    const { error: revokeError, count } = await client
      .from('sessions')
      .delete({ count: 'exact' })
      .eq('family_id', familyId);
    if (revokeError) {
      this.logger.error(`Failed to revoke session family ${familyId}: ${revokeError.message}`);
    } else {
      this.logger.error(`Revoked ${count ?? 0} session(s) in family ${familyId} after refresh-token replay`);
    }
    try {
      await this.auditService.logWithBeforeAfter({
        actorWallet: wallet,
        action: 'auth.refresh_token_reuse',
        resource: 'session',
        resourceId: null,
        beforeState: null,
        afterState: { revoked_sessions: count ?? 0 },
        metadata: { family_id: familyId },
      });
    } catch (auditError) {
      this.logger.error('Failed to write refresh-token-reuse audit log', auditError);
    }
  }
}
