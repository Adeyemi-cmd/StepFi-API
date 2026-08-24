import { Test, TestingModule } from '@nestjs/testing';
import { SessionCleanupService } from '../../../../src/jobs/session-cleanup/session-cleanup.service';
import { SupabaseService } from '../../../../src/database/supabase.client';

describe('SessionCleanupService', () => {
  let service: SessionCleanupService;
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
        SessionCleanupService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<SessionCleanupService>(SessionCleanupService);

    loggerErrorSpy = jest.spyOn((service as unknown as { logger: { error: jest.Mock } }).logger, 'error').mockImplementation(() => {});

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

  it('should delete only rows whose expiry is more than an hour in the past', async () => {
    const before = Date.now();

    await service.cleanupExpiredSessions();

    expect(mockFrom).toHaveBeenCalledWith('sessions');
    expect(deleteLt).toHaveBeenCalledTimes(1);

    const [column, cutoffIso] = deleteLt.mock.calls[0];
    expect(column).toBe('expires_at');
    const cutoff = new Date(cutoffIso as string).getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - 60 * 60 * 1000 - 2000);
    expect(cutoff).toBeLessThanOrEqual(before - 60 * 60 * 1000 + 2000);
  });

  it('should log the number of deleted sessions', async () => {
    const logSpy = jest.spyOn((service as unknown as { logger: { log: jest.Mock } }).logger, 'log').mockImplementation(() => {});

    await service.cleanupExpiredSessions();

    expect(logSpy).toHaveBeenCalledWith('Deleted 3 expired sessions');
  });

  it('should not throw when the delete fails — only log the error', async () => {
    deleteLt.mockResolvedValue({ error: { message: 'connection reset' }, count: null });

    await expect(service.cleanupExpiredSessions()).resolves.toBeUndefined();
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('should swallow unexpected exceptions so the cron never throws unhandled', async () => {
    deleteLt.mockRejectedValue(new Error('network failure'));

    await expect(service.cleanupExpiredSessions()).resolves.toBeUndefined();
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
