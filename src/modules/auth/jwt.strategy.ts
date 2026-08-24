import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatusService } from './user-status.service';

interface JwtPayload {
  wallet: string;
  type: string;
  role?: string | null;
  iat: number;
  exp: number;
}

/**
 * Passport JWT strategy for validating access tokens.
 *
 * Extracts the Bearer token from the Authorization header, verifies its
 * signature using JWT_SECRET, and returns the wallet address as req.user.
 *
 * Only tokens with type === 'access' are accepted to prevent refresh tokens
 * from being used to authenticate API requests.
 *
 * On every request the user's account status is checked through
 * UserStatusService (short-TTL cache; staleness bound documented there), so
 * blocked wallets are denied access within that bound instead of retaining
 * access until their token naturally expires.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userStatusService: UserStatusService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Called by Passport after the token signature is verified.
   * The returned value is injected into req.user.
   *
   * @param payload - Decoded JWT payload
   * @returns User object containing the wallet address
   */
  async validate(payload: JwtPayload): Promise<{ wallet: string; role: string | null }> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Invalid or missing access token.',
      });
    }

    await this.userStatusService.ensureNotBlocked(payload.wallet);

    // Tokens issued before the role claim existed simply carry role: null;
    // RolesGuard will deny role-gated routes until the client refreshes.
    return { wallet: payload.wallet, role: payload.role ?? null };
  }
}
