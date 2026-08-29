import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import pino from 'pino';

/**
 * Configuration factory for the StepFi API Cache layer.
 * 
 * Uses 'cache-manager-redis-store' (v3 compatible with Nest 10).
 * Defaults to localhost:6379 for local development.
 * 
 * TTL: Time to live in seconds (default: 300 - 5 minutes)
 */
/** Cache options shape consumed by CacheModule.registerAsync (store is the redis client factory). */
export interface RedisCacheConfig {
  ttl: number;
  store?: unknown;
}

export const getRedisConfig = async (configService: ConfigService): Promise<RedisCacheConfig> => {
  const isTest = process.env.NODE_ENV === 'test';
  const redisUrl = configService.get<string>('REDIS_URL');
  const ttl = configService.get<number>('REPUTATION_CACHE_TTL', 300);

  // If we are in test mode or no Redis URL is provided, fall back to in-memory store.
  // In-memory is per-instance and therefore NOT suitable for ApiKeyGuard's
  // shared invalidation/rate-limiting (revocation and 429 counters become
  // per-instance). Production must set REDIS_URL; we warn loudly when falling
  // back outside tests.
  if (isTest || !redisUrl) {
    if (!isTest && !redisUrl) {
      pino().warn('REDIS_URL is not set — falling back to in-memory cache. ApiKeyGuard revocation and per-key/per-IP rate limiting will be per-instance only and should not be used in production.');
    }
    return {
      ttl,
    };
  }

  // Use Redis only if explicitly configured
  try {
    return {
      store: await redisStore({
        url: redisUrl,
        ttl,
      }),
      ttl,
    };
  } catch (error) {
    pino().warn({ error: error.message }, 'Failed to initialize Redis store, falling back to in-memory cache');
    return {
      ttl,
    };
  }
};
