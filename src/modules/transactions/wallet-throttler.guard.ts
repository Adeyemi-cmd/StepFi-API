import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard variant that keys rate limits on the authenticated wallet
 * (from the JWT payload) instead of the client IP. Used alongside the global
 * IP-based guard so POST /transactions/submit is bounded per wallet AND per
 * IP, preventing a single wallet from being used as an open relay to Horizon.
 *
 * Also checks req.body.wallet so the same guard can be reused for
 * unauthenticated routes like POST /auth/verify where the wallet is in the
 * request body.
 */
@Injectable()
export class WalletThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as { user?: { wallet?: unknown } }).user;
    const body = (req as { body?: { wallet?: unknown } }).body;
    const userWallet = typeof user?.wallet === 'string' ? user.wallet : undefined;
    const bodyWallet = typeof body?.wallet === 'string' ? body.wallet : undefined;
    const wallet = userWallet ?? bodyWallet;
    return wallet ? `wallet:${wallet}` : super.getTracker(req as Record<string, unknown>);
  }
}
