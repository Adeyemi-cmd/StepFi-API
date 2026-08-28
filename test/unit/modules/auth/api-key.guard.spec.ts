import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UnauthorizedException, ForbiddenException, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cache } from 'cache-manager';
import { ApiKeyGuard } from '../../../../src/auth/guards/api-key.guard';
import { SupabaseService } from '../../../../src/database/supabase.client';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockSupabaseClient: Record<string, jest.Mock>;
  let mockSupabaseService: { getServiceRoleClient: jest.Mock };
  let mockReflector: { get: jest.Mock };
  let mockCacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    store: Map<string, { value: unknown; expiresAt?: number }>;
  };
  let mockContext: {
    switchToHttp: jest.Mock;
    getRequest: jest.Mock;
    getHandler: jest.Mock;
  };

  const activeKeyRecord = {
    id: 'key-uuid',
    vendor_id: 'vendor-uuid',
    name: 'Test Key',
    key_prefix: 'sfi_a1b2',
    key_hash: 'abc123hash',
    permissions: ['loans:read', 'loans:write'],
    is_active: true,
    last_used_at: null,
    expires_at: null,
    created_at: '2026-06-27T00:00:00Z',
    updated_at: '2026-06-27T00:00:00Z',
  };

  const validApiKey = 'sfi_' + 'a'.repeat(64);

  function createMockCache(): typeof mockCacheManager {
    const store = new Map<string, { value: unknown; expiresAt?: number }>();
    return {
      store,
      get: jest.fn(async (key: string) => {
        const entry = store.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          store.delete(key);
          return undefined;
        }
        return entry.value;
      }),
      set: jest.fn(async (key: string, value: unknown, ttlSeconds?: number) => {
        const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
        store.set(key, { value, expiresAt });
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    };
  }

  function createSupabaseMock(result: { data: unknown; error: unknown }) {
    const singleFn = jest.fn().mockResolvedValue(result);
    const eqFn = jest.fn().mockReturnValue({ single: singleFn });
    const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
    const updateEqFn = jest.fn().mockResolvedValue({ error: null });
    const updateFn = jest.fn().mockReturnValue({ eq: updateEqFn });
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'api_keys') {
        return {
          select: selectFn,
          update: updateFn,
        };
      }
      return { select: selectFn, update: updateFn } as unknown as ReturnType<typeof mockSupabaseClient.from>;
    });
    return { singleFn, eqFn, selectFn, updateFn, updateEqFn };
  }

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn(),
    } as unknown as Record<string, jest.Mock>;

    mockSupabaseService = {
      getServiceRoleClient: jest.fn(() => mockSupabaseClient),
    };

    mockReflector = {
      get: jest.fn().mockReturnValue(null),
    };

    mockCacheManager = createMockCache();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: Reflector, useValue: mockReflector },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);

    mockContext = {
      switchToHttp: jest.fn().mockReturnThis(),
      getRequest: jest.fn(),
      getHandler: jest.fn().mockReturnValue(() => {}),
    } as unknown as typeof mockContext;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function setupRequest(headers: Record<string, unknown>) {
    const request: Record<string, unknown> = { headers };
    mockContext.switchToHttp.mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    });
    return request as { headers: Record<string, unknown>; apiKey?: unknown };
  }

  // ---------------------------------------------------------------------------
  // canActivate — basic scenarios
  // ---------------------------------------------------------------------------
  describe('canActivate — basic and enumeration uniformity', () => {
    it('should return true when X-API-Key is valid and active', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });

      const result = await guard.canActivate(mockContext as unknown as never);
      expect(result).toBe(true);
    });

    it('should throw API_KEY_UNAUTHORIZED when X-API-Key header is absent (normalized)', async () => {
      setupRequest({});

      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        response: { code: 'API_KEY_UNAUTHORIZED' },
      });
    });

    it('should throw API_KEY_UNAUTHORIZED when X-API-Key is not a string (normalized)', async () => {
      setupRequest({ 'x-api-key': ['key1', 'key2'] as unknown as string });

      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        response: { code: 'API_KEY_UNAUTHORIZED' },
      });
    });

    it('should throw API_KEY_UNAUTHORIZED when key_hash not found (normalized)', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: null, error: { message: 'No rows found' } });

      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        response: { code: 'API_KEY_UNAUTHORIZED' },
      });
    });

    it('should throw API_KEY_UNAUTHORIZED when database error occurs (normalized, logged server-side)', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: null, error: { message: 'DB error' } });

      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        response: { code: 'API_KEY_UNAUTHORIZED' },
      });
    });

    it('should throw API_KEY_UNAUTHORIZED when key is revoked (normalized, was API_KEY_INACTIVE)', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({
        data: { ...activeKeyRecord, is_active: false },
        error: null,
      });

      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        response: { code: 'API_KEY_UNAUTHORIZED' },
      });
    });

    it('should throw API_KEY_UNAUTHORIZED when key is past expiry (normalized, was API_KEY_EXPIRED)', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({
        data: {
          ...activeKeyRecord,
          expires_at: new Date(Date.now() - 86400000).toISOString(),
        },
        error: null,
      });

      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        response: { code: 'API_KEY_UNAUTHORIZED' },
      });
    });

    it('enumeration uniformity: missing, invalid, inactive, expired all yield API_KEY_UNAUTHORIZED', async () => {
      const cases: Array<{ headers: Record<string, unknown>; db: { data: unknown; error: unknown } | null }> = [
        { headers: {}, db: null },
        { headers: { 'x-api-key': validApiKey }, db: { data: null, error: { message: 'No rows found' } } },
        {
          headers: { 'x-api-key': validApiKey },
          db: { data: { ...activeKeyRecord, is_active: false }, error: null },
        },
        {
          headers: { 'x-api-key': validApiKey },
          db: {
            data: { ...activeKeyRecord, expires_at: new Date(Date.now() - 1000).toISOString() },
            error: null,
          },
        },
      ];

      for (const c of cases) {
        // Reset cache between cases to avoid cross-contamination
        mockCacheManager.store.clear();
        setupRequest(c.headers);
        if (c.db) createSupabaseMock(c.db);
        await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
          response: { code: 'API_KEY_UNAUTHORIZED' },
        });
      }
    });

    it('should not reject when expiry is in the future', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({
        data: {
          ...activeKeyRecord,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
        error: null,
      });

      const result = await guard.canActivate(mockContext as unknown as never);
      expect(result).toBe(true);
    });

    it('should set request.apiKey with the key record', async () => {
      const request = setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });

      await guard.canActivate(mockContext as unknown as never);
      expect(request).toHaveProperty('apiKey');
      expect((request as unknown as { apiKey: { id: string } }).apiKey.id).toBe('key-uuid');
    });
  });

  // ---------------------------------------------------------------------------
  // Caching — steady state ≤1 lookup per TTL per key
  // ---------------------------------------------------------------------------
  describe('caching', () => {
    it('cache hit avoids DB call (mock assertions)', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      const { selectFn } = createSupabaseMock({ data: activeKeyRecord, error: null });

      // First request hits DB and populates cache
      await expect(guard.canActivate(mockContext as unknown as never)).resolves.toBe(true);
      expect(selectFn).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('apikey:record:'),
        expect.objectContaining({ id: 'key-uuid' }),
        expect.any(Number),
      );

      // Second request with same key should hit cache and not hit DB
      const request2 = setupRequest({ 'x-api-key': validApiKey });
      // Reset select mock to detect new calls
      const secondSelectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: activeKeyRecord, error: null }) }),
      });
      mockSupabaseClient.from.mockReturnValue({
        select: secondSelectFn,
        update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      } as unknown as ReturnType<typeof mockSupabaseClient.from>);

      await expect(guard.canActivate(mockContext as unknown as never)).resolves.toBe(true);
      expect(secondSelectFn).not.toHaveBeenCalled();
      // apiKey still set correctly from cache
      expect(request2).toHaveProperty('apiKey');
    });

    it('revocation invalidates within one TTL (vendors service deletes cache)', async () => {
      // This test documents the contract: VendorsService.revokeApiKey deletes
      // `apikey:record:<hash>` plus rate/last_used keys. Here we verify the
      // guard respects a manual del (simulating revocation).
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });
      await guard.canActivate(mockContext as unknown as never);
      expect(mockCacheManager.store.size).toBeGreaterThan(0);

      // Simulate revocation invalidation
      const hash = require('crypto').createHash('sha256').update(validApiKey).digest('hex');
      await mockCacheManager.del(`apikey:record:${hash}`);
      expect(await mockCacheManager.get(`apikey:record:${hash}`)).toBeUndefined();

      // Next request should miss cache and hit DB again (which will now see inactive)
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({
        data: { ...activeKeyRecord, is_active: false },
        error: null,
      });
      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        response: { code: 'API_KEY_UNAUTHORIZED' },
      });
    });

    it('never stores full keys in cache (only hash-derived keys)', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });
      await guard.canActivate(mockContext as unknown as never);

      const cacheKeys = Array.from(mockCacheManager.store.keys());
      const hasRawKey = cacheKeys.some((k) => k.includes(validApiKey));
      expect(hasRawKey).toBe(false);
      const hasHashKey = cacheKeys.some((k) => k.startsWith('apikey:record:'));
      expect(hasHashKey).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rate limiting — per-key sliding window
  // ---------------------------------------------------------------------------
  describe('rate limiting', () => {
    it('rate limit trips and returns structured 429', async () => {
      // Pre-fill rate counter to just below limit
      const hash = require('crypto').createHash('sha256').update(validApiKey).digest('hex');
      // We need to know the keyId to build rate key; guard uses keyRecord.id
      // Simulate 60 requests already counted
      const rateKey = `apikey:rate:${activeKeyRecord.id}`;
      await mockCacheManager.set(rateKey, 60, 60);

      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });

      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        status: 429,
        response: { code: 'API_KEY_RATE_LIMITED' },
      });
    });

    it('rate limit resets after TTL', async () => {
      const rateKey = `apikey:rate:${activeKeyRecord.id}`;
      await mockCacheManager.set(rateKey, 60, 1); // 1 second TTL
      // Wait for expiry
      await new Promise((r) => setTimeout(r, 1100));

      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });

      await expect(guard.canActivate(mockContext as unknown as never)).resolves.toBe(true);
    });

    it('successful requests increment rate counter', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });

      await guard.canActivate(mockContext as unknown as never);
      const rateKey = `apikey:rate:${activeKeyRecord.id}`;
      const count = (await mockCacheManager.get(rateKey)) as unknown as number;
      expect(count).toBe(1);

      // Second request increments
      setupRequest({ 'x-api-key': validApiKey });
      // Need to keep cache for record, but rate key should increment
      // guard will hit cache for record, so no DB needed, but we still need mock for DB fallback (should not be called)
      await guard.canActivate(mockContext as unknown as never);
      const count2 = (await mockCacheManager.get(rateKey)) as unknown as number;
      expect(count2).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Permission enforcement
  // ---------------------------------------------------------------------------
  describe('permission enforcement', () => {
    it('should pass when required permissions match key permissions', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });
      mockReflector.get.mockReturnValue(['loans:read']);

      const result = await guard.canActivate(mockContext as unknown as never);
      expect(result).toBe(true);
    });

    it('should pass when key has any of the required permissions', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });
      mockReflector.get.mockReturnValue(['loans:write', 'transactions:read']);

      const result = await guard.canActivate(mockContext as unknown as never);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException (API_KEY_INSUFFICIENT_PERMISSIONS) when key lacks required permissions', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });
      mockReflector.get.mockReturnValue(['admin:write']);

      await expect(guard.canActivate(mockContext as unknown as never)).rejects.toMatchObject({
        response: { code: 'API_KEY_INSUFFICIENT_PERMISSIONS' },
      });
    });

    it('should pass when no permissions are required on the endpoint', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });
      mockReflector.get.mockReturnValue(null);

      const result = await guard.canActivate(mockContext as unknown as never);
      expect(result).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // last_used_at update — throttled to at-most-once-per-5-minutes-per-key
  // ---------------------------------------------------------------------------
  describe('last_used_at throttling', () => {
    it('should trigger last_used_at update on first successful authentication', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      const { updateFn } = createSupabaseMock({ data: activeKeyRecord, error: null });

      await guard.canActivate(mockContext as unknown as never);
      // Allow fire-and-forget to complete
      await new Promise((r) => setImmediate(r));

      // update should have been called once (plus the rate-limit cache, but we check from mock)
      // The mock's from was called for select and for update
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('api_keys');
      // We can verify that update was attempted by checking the mock's call count
      // The updateFn is for last_used_at
      expect(updateFn).toHaveBeenCalled();
    });

    it('should collapse last_used_at writes within TTL (second request does not hit DB for update)', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      createSupabaseMock({ data: activeKeyRecord, error: null });
      await guard.canActivate(mockContext as unknown as never);
      await new Promise((r) => setImmediate(r));

      const callCountAfterFirst = mockSupabaseClient.from.mock.calls.length;

      // Second request should hit cache for record and skip last_used update due to dirty flag
      setupRequest({ 'x-api-key': validApiKey });
      // Keep cache, so DB not hit for record; but we need to ensure update not called again
      await guard.canActivate(mockContext as unknown as never);
      await new Promise((r) => setImmediate(r));

      // from should not have been called again for update (only maybe for select if cache miss, but we have cache hit)
      // So call count should not increase by 1 for update
      // Since we use cache hit for record, no DB lookup, and last_used is throttled, no update
      expect(mockSupabaseClient.from.mock.calls.length).toBe(callCountAfterFirst);
    });

    it('should not throw when last_used_at update fails', async () => {
      setupRequest({ 'x-api-key': validApiKey });
      const singleFn = jest.fn().mockResolvedValue({ data: activeKeyRecord, error: null });
      const eqFn = jest.fn().mockReturnValue({ single: singleFn });
      const selectFn = jest.fn().mockReturnValue({ eq: eqFn });
      const updateEqFn = jest.fn().mockRejectedValue(new Error('Network error'));
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'api_keys') {
          return {
            select: selectFn,
            update: jest.fn().mockReturnValue({ eq: updateEqFn }),
          } as unknown as ReturnType<typeof mockSupabaseClient.from>;
        }
        return { select: selectFn } as unknown as ReturnType<typeof mockSupabaseClient.from>;
      });

      const result = await guard.canActivate(mockContext as unknown as never);
      expect(result).toBe(true);
      await new Promise((r) => setImmediate(r));
      // Still returns true despite update failure
    });
  });
});
