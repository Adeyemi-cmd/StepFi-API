import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

/**
 * Throttler guard variant that keys rate limits on the authenticated wallet
 * (from the JWT payload) instead of the client IP. Used alongside the global
 * IP-based guard so POST /transactions/submit is bounded per wallet AND per
 * IP, preventing a single wallet from being used as an open relay to Horizon.
 *
 * Also checks req.body.wallet so the same guard can be reused for
 * unauthenticated routes like POST /auth/verify where the wallet is in the
 * request body.
 *
 * DI-free implementation (see AuthWalletThrottlerGuard for rationale) so
 * `@UseGuards(WalletThrottlerGuard)` works without Nest injecting
 * `ThrottlerStorageService`.
 */
@Injectable()
export class WalletThrottlerGuard implements CanActivate {
  private static readonly hits = new Map<string, { count: number; expiresAt: number }>();
  private readonly limit = 10;
  private readonly ttl = 60000;

  constructor() {}

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as { user?: { wallet?: unknown } }).user;
    const body = (req as { body?: { wallet?: unknown } }).body;
    const userWallet = typeof user?.wallet === 'string' ? user.wallet : undefined;
    const bodyWallet = typeof body?.wallet === 'string' ? body.wallet : undefined;
    const wallet = userWallet ?? bodyWallet;
    if (wallet) return `wallet:${wallet}`;
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
    const entry = WalletThrottlerGuard.hits.get(tracker);
    if (!entry || now > entry.expiresAt) {
      WalletThrottlerGuard.hits.set(tracker, { count: 1, expiresAt: now + this.ttl });
      return true;
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      throw new ThrottlerException();
    }
    return true;
  }

  static clearStorage(): void {
    WalletThrottlerGuard.hits.clear();
  }
}
