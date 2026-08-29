import { Test, TestingModule } from '@nestjs/testing';
import { NonceCleanupService } from '../../../../src/jobs/nonce-cleanup/nonce-cleanup.service';
import { SupabaseService } from '../../../../src/database/supabase.client';

describe('NonceCleanupService', () => {
  let service: NonceCleanupService;
  let loggerErrorSpy: jest.SpyInstance;

  const deleteLt = jest.fn();
  const mockDelete = jest.fn().mockReturnValue({ lt: deleteLt });
  const mockFrom = jest.fn().mockReturnValue({ delete: mockDelete });

  const mockSupabaseService = {
    getServiceRoleClient: jest.fn(() => ({ from: mockFrom })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NonceCleanupService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<NonceCleanupService>(NonceCleanupService);

    loggerErrorSpy = jest
      .spyOn((service as unknown as { logger: { error: jest.Mock } }).logger, 'error')
      .mockImplementation(() => {});

    jest.clearAllMocks();
    loggerErrorSpy.mockImplementation(() => {});
    mockDelete.mockReturnValue({ lt: deleteLt });
    deleteLt.mockResolvedValue({ error: null, count: 3 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delete only rows whose expiry is more than an hour in the past (burned or unused)', async () => {
    const before = Date.now();

    await service.cleanupExpiredNonces();

    expect(mockFrom).toHaveBeenCalledWith('nonces');
    expect(deleteLt).toHaveBeenCalledTimes(1);

    const [column, cutoffIso] = deleteLt.mock.calls[0];
    expect(column).toBe('expires_at');
    const cutoff = new Date(cutoffIso as string).getTime();
    // cutoff is now - 1 hour, tolerance 2s
    expect(cutoff).toBeGreaterThanOrEqual(before - 60 * 60 * 1000 - 2000);
    expect(cutoff).toBeLessThanOrEqual(before - 60 * 60 * 1000 + 2000);
  });

  it('should log the number of deleted nonces (including burned expired rows)', async () => {
    const logSpy = jest
      .spyOn((service as unknown as { logger: { log: jest.Mock } }).logger, 'log')
      .mockImplementation(() => {});

    await service.cleanupExpiredNonces();

    expect(logSpy).toHaveBeenCalledWith('Deleted 3 expired nonces');
  });

  it('should not throw when the delete fails — only log the error', async () => {
    deleteLt.mockResolvedValue({ error: { message: 'connection reset' }, count: null });

    await expect(service.cleanupExpiredNonces()).resolves.toBeUndefined();
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('should swallow unexpected exceptions so the cron never throws unhandled', async () => {
    deleteLt.mockRejectedValue(new Error('network failure'));

    await expect(service.cleanupExpiredNonces()).resolves.toBeUndefined();
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('should be idempotent — second immediate run with same cutoff uses same predicate', async () => {
    deleteLt.mockResolvedValue({ error: null, count: 0 });
    await service.cleanupExpiredNonces();
    expect(mockFrom).toHaveBeenCalledWith('nonces');
    await service.cleanupExpiredNonces();
    // called twice, second run touches zero rows but does not error
    expect(deleteLt).toHaveBeenCalledTimes(2);
  });
});
