import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { UserStatusService, USER_STATUS_CACHE_TTL_MS } from '../../../../src/modules/auth/user-status.service';
import { SupabaseService } from '../../../../src/database/supabase.client';

describe('UserStatusService', () => {
  let service: UserStatusService;

  const selectSingle = jest.fn();
  const mockSupabaseClient = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: selectSingle,
    }),
  };

  const mockSupabaseService = {
    getServiceRoleClient: jest.fn(() => mockSupabaseClient),
  };

  const validWallet = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserStatusService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<UserStatusService>(UserStatusService);

    jest.clearAllMocks();
    selectSingle.mockResolvedValue({ data: { status: 'active' }, error: null });
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: selectSingle,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return status from the database on first lookup', async () => {
    await expect(service.getStatus(validWallet)).resolves.toBe('active');
    expect(selectSingle).toHaveBeenCalledTimes(1);
  });

  it('should serve subsequent lookups from cache within the TTL window', async () => {
    await service.getStatus(validWallet);
    await service.getStatus(validWallet);
    await service.ensureNotBlocked(validWallet);

    expect(selectSingle).toHaveBeenCalledTimes(1);
  });

  it('should re-query the database once the cache entry expires', async () => {
    await service.getStatus(validWallet);

    const now = Date.now();
    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy.mockReturnValue(now + USER_STATUS_CACHE_TTL_MS + 1);

    await service.getStatus(validWallet);

    expect(selectSingle).toHaveBeenCalledTimes(2);
    dateSpy.mockRestore();
  });

  it('should throw AUTH_USER_BLOCKED when the cached/queried status is blocked', async () => {
    selectSingle.mockResolvedValue({ data: { status: 'blocked' }, error: null });

    await expect(service.ensureNotBlocked(validWallet)).rejects.toThrow(UnauthorizedException);
    await expect(service.ensureNotBlocked(validWallet)).rejects.toMatchObject({
      response: { code: 'AUTH_USER_BLOCKED' },
    });
  });

  it('should stop throwing after invalidate() forces a fresh DB check', async () => {
    selectSingle.mockResolvedValue({ data: { status: 'blocked' }, error: null });
    await expect(service.ensureNotBlocked(validWallet)).rejects.toThrow(UnauthorizedException);

    selectSingle.mockResolvedValue({ data: { status: 'active' }, error: null });
    // Still blocked — served from cache.
    await expect(service.ensureNotBlocked(validWallet)).rejects.toThrow(UnauthorizedException);

    service.invalidate(validWallet);
    await expect(service.ensureNotBlocked(validWallet)).resolves.toBeUndefined();
  });

  it('should fail open (treat as active) when the status query errors', async () => {
    selectSingle.mockResolvedValue({ data: null, error: { message: 'DB down' } });

    await expect(service.ensureNotBlocked(validWallet)).resolves.toBeUndefined();
  });
});
