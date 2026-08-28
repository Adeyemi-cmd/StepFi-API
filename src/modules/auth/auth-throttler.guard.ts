import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard variant for POST /auth/verify that keys rate limits on the
 * wallet address supplied in the request body (unauthenticated) or on the
 * authenticated wallet (if present). Prefers body wallet because verify is
 * unauthenticated — the wallet is not yet in req.user.
 *
 * Falls back to the default IP-based tracker when no wallet is present so
 * anonymous/probe traffic is still bounded per IP.
 *
 * Used alongside the global IP-based ThrottlerGuard so POST /auth/verify is
 * bounded per wallet AND per IP — preventing brute-force of the SEP-0043
 * fallback space at network speed and limiting stolen-nonce replay attempts.
 */
@Injectable()
export class AuthWalletThrottlerGuard extends ThrottlerGuard {
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
    return super.getTracker(req);
  }
}
