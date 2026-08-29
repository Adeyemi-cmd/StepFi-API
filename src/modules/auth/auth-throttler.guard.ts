import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

/**
 * Throttler guard variant for POST /auth/verify that keys rate limits on the
 * wallet address supplied in the request body (unauthenticated) or on the
 * authenticated wallet (if present). Prefers body wallet because verify is
 * unauthenticated — the wallet is not yet in req.user.
 *
 * Falls back to IP-based tracking when no wallet is present so
 * anonymous/probe traffic is still bounded per IP.
 *
 * Used alongside the global IP-based ThrottlerGuard so POST /auth/verify is
 * bounded per wallet AND per IP — preventing brute-force of the SEP-0043
 * fallback space at network speed and limiting stolen-nonce replay attempts.
 *
 * Implements its own in-memory sliding window so it works with
 * `@UseGuards(AuthWalletThrottlerGuard)` without requiring Nest DI for
 * ThrottlerGuard's storage service (which is not injected when a guard is
 * instantiated via `@UseGuards`). Mirrors the semantics of the legacy
 * `ThrottlerGuard extends` version but is DI-free and therefore testable
 * with a plain `new` and usable in e2e without additional module wiring.
 */
@Injectable()
export class AuthWalletThrottlerGuard implements CanActivate {
  private static readonly hits = new Map<string, { count: number; expiresAt: number }>();
  private readonly limit = 5;
  private readonly ttl = 60000;

  constructor() {}

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = (req as { body?: { wallet?: unknown } }).body;
    const user = (req as { user?: { wallet?: unknown } }).user;
    const bodyWallet = typeof body?.wallet === 'string' ? body.wallet : undefined;
    const userWallet = typeof user?.wallet === 'string' ? user.wallet : undefined;
    // Prefer body wallet for unauthenticated verify; fall back to user wallet.
    const wallet = bodyWallet ?? userWallet;
    if (wallet) {
      return `wallet:${wallet}`;
    }
    const ip = (req as unknown as { ip?: string }).ip;
    if (typeof ip === 'string' && ip.length > 0) return ip;
    const forwarded = (req as unknown as { headers?: Record<string, string> }).headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
    return 'unknown';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    const tracker = await this.getTracker(req);
    const now = Date.now();
    const entry = AuthWalletThrottlerGuard.hits.get(tracker);
    if (!entry || now > entry.expiresAt) {
      AuthWalletThrottlerGuard.hits.set(tracker, { count: 1, expiresAt: now + this.ttl });
      return true;
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      throw new ThrottlerException();
    }
    return true;
  }

  /** Test helper: reset in-memory throttle state between isolated tests. */
  static clearStorage(): void {
    AuthWalletThrottlerGuard.hits.clear();
  }
}
