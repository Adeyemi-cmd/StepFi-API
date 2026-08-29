import { AuthWalletThrottlerGuard } from '../../../../src/modules/auth/auth-throttler.guard';

describe('AuthWalletThrottlerGuard', () => {
  function createGuard(): AuthWalletThrottlerGuard {
    const storageService = {
      increment: jest.fn(),
      getRecord: jest.fn(),
    };
    const options = [{ ttl: 60000, limit: 5 }];
    const reflector = {};
    return new (AuthWalletThrottlerGuard as unknown as new (
      ...args: unknown[]
    ) => AuthWalletThrottlerGuard)(options, storageService, reflector);
  }

  function getTrackerOf(guard: AuthWalletThrottlerGuard, req: unknown): Promise<string> {
    return (
      guard as unknown as { getTracker: (request: unknown) => Promise<string> }
    ).getTracker(req);
  }

  it('keys the rate limit on the wallet from request body when present (unauthenticated verify)', async () => {
    const guard = createGuard();
    const wallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

    await expect(getTrackerOf(guard, { body: { wallet } })).resolves.toBe(`wallet:${wallet}`);
  });

  it('keys the rate limit on the authenticated wallet when present', async () => {
    const guard = createGuard();
    const wallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

    await expect(getTrackerOf(guard, { user: { wallet } })).resolves.toBe(`wallet:${wallet}`);
  });

  it('prefers body wallet over user wallet when both are present', async () => {
    const guard = createGuard();
    const bodyWallet = 'GBODYWALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const userWallet = 'GUSERWALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    await expect(
      getTrackerOf(guard, { body: { wallet: bodyWallet }, user: { wallet: userWallet } }),
    ).resolves.toBe(`wallet:${bodyWallet}`);
  });

  it('falls back to the IP-based tracker when no wallet is present', async () => {
    const guard = createGuard();

    await expect(getTrackerOf(guard, { ip: '203.0.113.7' })).resolves.toBe('203.0.113.7');
  });

  it('falls back to IP when body wallet is not a string', async () => {
    const guard = createGuard();

    await expect(getTrackerOf(guard, { ip: '198.51.100.9', body: { wallet: 123 } })).resolves.toBe(
      '198.51.100.9',
    );
  });

  describe('canActivate throttling', () => {
    beforeEach(() => {
      AuthWalletThrottlerGuard.clearStorage();
    });

    function mockContext(req: unknown): import('@nestjs/common').ExecutionContext {
      return {
        switchToHttp: () => ({ getRequest: () => req }),
        getType: () => 'http',
      } as unknown as import('@nestjs/common').ExecutionContext;
    }

    it('allows 5 requests per wallet then throws ThrottlerException on 6th', async () => {
      const guard = createGuard();
      const wallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
      const req = { body: { wallet }, ip: '1.2.3.4' };

      for (let i = 0; i < 5; i++) {
        await expect(guard.canActivate(mockContext(req))).resolves.toBe(true);
      }
      await expect(guard.canActivate(mockContext(req))).rejects.toThrow();
    });

    it('isolates throttling per wallet', async () => {
      const guard = createGuard();
      const walletA = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const walletB = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
      const reqA = { body: { wallet: walletA }, ip: '1.2.3.4' };
      const reqB = { body: { wallet: walletB }, ip: '1.2.3.4' };

      for (let i = 0; i < 5; i++) {
        await expect(guard.canActivate(mockContext(reqA))).resolves.toBe(true);
      }
      await expect(guard.canActivate(mockContext(reqA))).rejects.toThrow();
      // walletB should still be allowed
      await expect(guard.canActivate(mockContext(reqB))).resolves.toBe(true);
    });
  });
});
