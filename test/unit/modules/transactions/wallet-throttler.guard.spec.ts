import { WalletThrottlerGuard } from '../../../../src/modules/transactions/wallet-throttler.guard';

describe('WalletThrottlerGuard', () => {
  function createGuard(): WalletThrottlerGuard {
    const storageService = {
      increment: jest.fn(),
      getRecord: jest.fn(),
    };
    const options = [{ ttl: 60000, limit: 10 }];
    const reflector = {};
    return new (WalletThrottlerGuard as any)(options, storageService, reflector);
  }

  function getTrackerOf(guard: WalletThrottlerGuard, req: unknown): Promise<string> {
    return (guard as unknown as {
      getTracker: (request: unknown) => Promise<string>;
    }).getTracker(req);
  }

  it('keys the rate limit on the authenticated wallet when present', async () => {
    const guard = createGuard();
    const wallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

    await expect(getTrackerOf(guard, { user: { wallet } })).resolves.toBe(`wallet:${wallet}`);
  });

  it('falls back to the IP-based tracker when no user is present', async () => {
    const guard = createGuard();

    await expect(getTrackerOf(guard, { ip: '203.0.113.7' })).resolves.toBe('203.0.113.7');
  });

  it('falls back to the IP-based tracker when the user object has no wallet', async () => {
    const guard = createGuard();

    await expect(getTrackerOf(guard, { ip: '198.51.100.9', user: {} })).resolves.toBe(
      '198.51.100.9',
    );
  });

  describe('canActivate throttling', () => {
    beforeEach(() => {
      WalletThrottlerGuard.clearStorage();
    });
    function mockContext(req: unknown): import('@nestjs/common').ExecutionContext {
      return {
        switchToHttp: () => ({ getRequest: () => req }),
        getType: () => 'http',
      } as unknown as import('@nestjs/common').ExecutionContext;
    }

    it('allows 10 requests per wallet then throws on 11th', async () => {
      const guard = createGuard();
      const wallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
      const req = { user: { wallet }, ip: '1.2.3.4' };
      for (let i = 0; i < 10; i++) {
        await expect(guard.canActivate(mockContext(req))).resolves.toBe(true);
      }
      await expect(guard.canActivate(mockContext(req))).rejects.toThrow();
    });
  });
});
