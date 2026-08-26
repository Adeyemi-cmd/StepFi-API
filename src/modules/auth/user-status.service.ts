import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.client';

/**
 * How long a user's status may be served from cache before re-checking the
 * database. This is the documented staleness bound for blocking enforcement:
 * a blocked wallet can keep using valid access tokens for AT MOST this many
 * seconds (plus the remaining lifetime of its current access token is NOT
 * granted — requests within this window are the only grace period).
 */
export const USER_STATUS_CACHE_TTL_MS = 30_000;

interface CachedStatus {
  status: string;
  expiresAt: number;
}

/**
 * Short-TTL in-memory cache of user account status, consulted on every
 * authenticated request by JwtStrategy so that blocked wallets lose API
 * access within USER_STATUS_CACHE_TTL_MS instead of waiting for their
 * access token to expire naturally.
 *
 * A local in-memory Map is used deliberately instead of Redis: the check
 * runs on every request, one Redis round trip per request would double
 * auth latency, and a 30s staleness bound does not justify shared state.
 * On multi-instance deployments each instance maintains its own cache with
 * the same bound.
 */
@Injectable()
export class UserStatusService {
  private readonly logger = new Logger(UserStatusService.name);
  private readonly cache = new Map<string, CachedStatus>();

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Returns the user's status ('active', 'blocked', ...), serving from the
   * cache when fresh. Never throws for DB errors — fails open so a database
   * blip cannot lock out every authenticated user; the failure is logged.
   */
  async getStatus(wallet: string): Promise<string> {
    const cached = this.cache.get(wallet);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.status;
    }
    let status = 'active';
    try {
      const client = this.supabaseService.getServiceRoleClient();
      const { data, error } = await client
        .from('users')
        .select('status')
        .eq('wallet_address', wallet)
        .maybeSingle();
      if (!error && data?.status) {
        status = data.status;
      }
      if (error) {
        this.logger.error(`Failed to read status for ${wallet}: ${error.message}`);
      }
    } catch (err) {
      this.logger.error(`User status lookup failed for ${wallet}`, err);
    }
    this.cache.set(wallet, { status, expiresAt: Date.now() + USER_STATUS_CACHE_TTL_MS });
    return status;
  }

  /** Throws AUTH_USER_BLOCKED when the wallet's account is suspended. */
  async ensureNotBlocked(wallet: string): Promise<void> {
    const status = await this.getStatus(wallet);
    if (status === 'blocked') {
      throw new UnauthorizedException({ code: 'AUTH_USER_BLOCKED', message: 'This account has been suspended.' });
    }
  }

  /** Test/admin helper: drops cached status so the next check hits the DB. */
  invalidate(wallet: string): void {
    this.cache.delete(wallet);
  }
}
