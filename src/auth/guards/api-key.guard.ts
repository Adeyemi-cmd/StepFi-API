import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { SupabaseService } from '../../database/supabase.client';
import { API_KEY_PERMISSIONS_KEY } from './api-key-permissions.decorator';

interface ApiKeyRecord {
  id: string;
  vendor_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  permissions: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Cache and rate-limit constants.
 *
 * - API_KEY_CACHE_TTL: short TTL for key records (≤1 DB lookup per TTL per key in steady state).
 * - API_KEY_LAST_USED_TTL: collapse last_used_at writes to at-most-once-per-N-minutes-per-key.
 * - API_KEY_RATE_LIMIT_* : per-key sliding-window (counts live in cache-manager, not DB).
 * - API_KEY_NEGATIVE_CACHE_TTL: short TTL for non-existent key hashes to avoid DB hammer
 *   on random-key floods. Intentionally small so enumeration attempts are still
 *   eventually re-checked.
 * - API_KEY_IP_RATE_LIMIT_* : per-IP burst protection for unauthenticated/unknown-key
 *   floods. Complements the global ThrottlerGuard (100 req/60s per IP) with a
 *   tighter per-IP budget for the API-key hot path so a single IP cannot
 *   saturate the Supabase pool with random keys.
 */
const API_KEY_CACHE_TTL_SECONDS = 60;
const API_KEY_LAST_USED_TTL_SECONDS = 300;
const API_KEY_RATE_LIMIT_WINDOW_SECONDS = 60;
const API_KEY_RATE_LIMIT_MAX_REQUESTS = 60;
const API_KEY_NEGATIVE_CACHE_TTL_SECONDS = 30;
const API_KEY_IP_RATE_LIMIT_WINDOW_SECONDS = 60;
const API_KEY_IP_RATE_LIMIT_MAX_REQUESTS = 30;

function getRecordCacheKey(keyHash: string): string {
  return `apikey:record:${keyHash}`;
}

function getNegativeCacheKey(keyHash: string): string {
  return `apikey:negative:${keyHash}`;
}

function getLastUsedCacheKey(keyId: string): string {
  return `apikey:last_used:${keyId}`;
}

function getRateLimitCacheKey(keyId: string): string {
  return `apikey:rate:${keyId}`;
}

function getIpRateLimitCacheKey(ip: string): string {
  return `apikey:ip:rate:${ip}`;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly supabaseService: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  private getClientIp(request: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0 && typeof forwarded[0] === 'string') {
      return forwarded[0].split(',')[0].trim();
    }
    if (typeof request.ip === 'string' && request.ip.length > 0) return request.ip;
    return 'unknown';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
      apiKey?: ApiKeyRecord;
    }>();

    const apiKeyHeader = request.headers['x-api-key'];
    const clientIp = this.getClientIp(request as unknown as { headers: Record<string, string | string[] | undefined>; ip?: string });

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      // Even missing/malformed keys count toward per-IP burst protection so a
      // headerless flood cannot bypass the DB guard.
      await this.enforceIpRateLimit(clientIp);
      this.logger.warn('API key missing or malformed header');
      throw new UnauthorizedException({
        code: 'API_KEY_UNAUTHORIZED',
        message: 'Invalid API key.',
      });
    }

    const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex');
    const recordCacheKey = getRecordCacheKey(keyHash);
    const negativeCacheKey = getNegativeCacheKey(keyHash);

    let keyRecord: ApiKeyRecord | undefined;

    try {
      keyRecord = await this.cacheManager.get<ApiKeyRecord>(recordCacheKey);
    } catch (error) {
      this.logger.warn(`API key cache read failed for ${keyHash.slice(0, 8)}...: ${(error as Error).message}`);
    }

    if (!keyRecord) {
      // Negative cache hit: recently observed non-existent hash, avoid DB.
      try {
        const isNegative = await this.cacheManager.get<boolean>(negativeCacheKey);
        if (isNegative) {
          await this.enforceIpRateLimit(clientIp);
          this.logger.warn(`API key negative-cache hit for hash ${keyHash.slice(0, 8)}... (IP ${clientIp})`);
          throw new UnauthorizedException({
            code: 'API_KEY_UNAUTHORIZED',
            message: 'Invalid API key.',
          });
        }
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        this.logger.warn(`API key negative-cache read failed for ${keyHash.slice(0, 8)}...: ${(error as Error).message}`);
      }

      // Per-IP burst protection before hitting Supabase for unknown keys.
      await this.enforceIpRateLimit(clientIp);

      const client = this.supabaseService.getServiceRoleClient();
      const { data, error } = await client.from('api_keys').select('*').eq('key_hash', keyHash).single();

      if (error || !data) {
        // Cache the negative result briefly so a random-key flood does not
        // hammer the DB once per request. TTL is intentionally short.
        try {
          await this.cacheManager.set(negativeCacheKey, true, API_KEY_NEGATIVE_CACHE_TTL_SECONDS);
        } catch (cacheError) {
          this.logger.warn(`API key negative-cache write failed for ${keyHash.slice(0, 8)}...: ${(cacheError as Error).message}`);
        }
        this.logger.warn(
          `API key lookup failed for hash ${keyHash.slice(0, 8)}...: ${error?.message ?? 'not found'}`,
        );
        throw new UnauthorizedException({
          code: 'API_KEY_UNAUTHORIZED',
          message: 'Invalid API key.',
        });
      }

      keyRecord = data as unknown as ApiKeyRecord;
    }

    // Unified validation: is_active and expires_at both map to the same
    // API_KEY_UNAUTHORIZED response to prevent enumeration of revoked vs
    // expired vs nonexistent keys. Details are logged server-side only.
    if (!keyRecord.is_active) {
      this.logger.warn(`API key inactive: ${keyRecord.id} (hash ${keyHash.slice(0, 8)}...)`);
      throw new UnauthorizedException({
        code: 'API_KEY_UNAUTHORIZED',
        message: 'Invalid API key.',
      });
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      this.logger.warn(`API key expired: ${keyRecord.id} (hash ${keyHash.slice(0, 8)}...)`);
      throw new UnauthorizedException({
        code: 'API_KEY_UNAUTHORIZED',
        message: 'Invalid API key.',
      });
    }

    // Cache the validated record for steady-state traffic (≤1 lookup per TTL per key).
    // Only cache after successful validation so inactive/expired records are not
    // served from cache; revocation explicitly invalidates via VendorsService.
    try {
      const cached = await this.cacheManager.get<ApiKeyRecord>(recordCacheKey);
      if (!cached) {
        await this.cacheManager.set(recordCacheKey, keyRecord, API_KEY_CACHE_TTL_SECONDS);
      }
    } catch (error) {
      this.logger.warn(`API key cache write failed for ${keyRecord.id}: ${(error as Error).message}`);
    }

    // Per-key sliding-window rate limit (cache-backed, not DB).
    await this.enforceRateLimit(keyRecord.id, keyHash);

    const requiredPermissions = this.reflector.get<string[]>(
      API_KEY_PERMISSIONS_KEY,
      context.getHandler(),
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const keyPermissions: string[] = keyRecord.permissions ?? [];
      const hasPermission = requiredPermissions.some((p) => keyPermissions.includes(p));
      if (!hasPermission) {
        throw new ForbiddenException({
          code: 'API_KEY_INSUFFICIENT_PERMISSIONS',
          message: 'API key does not have the required permissions for this resource.',
        });
      }
    }

    // Throttled last_used_at: at-most-once-per-N-minutes-per-key.
    // Fire-and-forget is intentionally not awaited to avoid adding latency to
    // the hot path; errors are logged.
    void this.maybeUpdateLastUsed(keyRecord.id);

    request.apiKey = keyRecord;
    return true;
  }

  private async enforceRateLimit(keyId: string, keyHash: string): Promise<void> {
    const rateKey = getRateLimitCacheKey(keyId);
    try {
      const current = (await this.cacheManager.get<number>(rateKey)) ?? 0;
      if (current >= API_KEY_RATE_LIMIT_MAX_REQUESTS) {
        this.logger.warn(
          `API key rate limited: ${keyId} (hash ${keyHash.slice(0, 8)}...) — ${current}/${API_KEY_RATE_LIMIT_MAX_REQUESTS} per ${API_KEY_RATE_LIMIT_WINDOW_SECONDS}s`,
        );
        throw new HttpException(
          {
            code: 'API_KEY_RATE_LIMITED',
            message: 'Too many requests for this API key. Please retry after a short delay.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const next = current + 1;
      // Sliding window: each increment resets TTL to full window. For a fixed
      // window we would preserve the original TTL, but sliding is simpler and
      // matches the per-key burst protection needed here.
      await this.cacheManager.set(rateKey, next, API_KEY_RATE_LIMIT_WINDOW_SECONDS);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Cache failures should not block legitimate traffic; log and allow.
      this.logger.warn(`API key rate-limit cache error for ${keyId}: ${(error as Error).message}`);
    }
  }

  private async enforceIpRateLimit(ip: string): Promise<void> {
    // Skip IP throttling for unknown IP (conservative: allow rather than block).
    if (!ip || ip === 'unknown') return;
    const ipKey = getIpRateLimitCacheKey(ip);
    try {
      const current = (await this.cacheManager.get<number>(ipKey)) ?? 0;
      if (current >= API_KEY_IP_RATE_LIMIT_MAX_REQUESTS) {
        this.logger.warn(`API key IP rate limited: ${ip} — ${current}/${API_KEY_IP_RATE_LIMIT_MAX_REQUESTS} per ${API_KEY_IP_RATE_LIMIT_WINDOW_SECONDS}s`);
        throw new HttpException(
          {
            code: 'API_KEY_RATE_LIMITED',
            message: 'Too many requests for this API key. Please retry after a short delay.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const next = current + 1;
      await this.cacheManager.set(ipKey, next, API_KEY_IP_RATE_LIMIT_WINDOW_SECONDS);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.warn(`API key IP rate-limit cache error for ${ip}: ${(error as Error).message}`);
    }
  }

  private async maybeUpdateLastUsed(keyId: string): Promise<void> {
    const lastUsedKey = getLastUsedCacheKey(keyId);
    try {
      const flagged = await this.cacheManager.get<boolean>(lastUsedKey);
      if (flagged) {
        return;
      }
      const client = this.supabaseService.getServiceRoleClient();
      await client.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyId);
      await this.cacheManager.set(lastUsedKey, true, API_KEY_LAST_USED_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Failed to update last_used_at for ${keyId}: ${(error as Error).message}`);
    }
  }
}
