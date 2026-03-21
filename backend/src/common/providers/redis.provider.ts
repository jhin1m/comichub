import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const logger = new Logger('RedisProvider');

/**
 * Creates a Redis client that gracefully degrades to a no-op stub
 * when Redis is unavailable. All get/set operations silently return
 * null so the app works without caching.
 */
export function createResilientRedis(config: ConfigService): Redis {
  const url = config.get<string>('redis.url', 'redis://localhost:6379');
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 500, 2000);
    },
    lazyConnect: true,
  });

  // Try connecting; if it fails, swap to no-op stub
  client.connect().catch(() => {
    logger.warn('Redis unavailable — running without cache');
    stubRedisClient(client);
  });

  client.on('error', () => {
    // suppress repeated connection errors
  });

  return client;
}

/** Override read/write methods so they silently no-op */
function stubRedisClient(client: Redis): void {
  const noop = async () => null;
  client.get = noop as never;
  client.set = noop as never;
  client.setex = noop as never;
  client.del = noop as never;
  client.keys = (async () => []) as never;
  client.incr = (async () => 0) as never;
  client.incrby = (async () => 0) as never;
  client.expire = noop as never;
  client.ttl = (async () => -2) as never;
  client.exists = (async () => 0) as never;
  client.scan = (async () => ['0', []]) as never;
  client.pipeline = (() => ({
    exec: async () => [],
    get: function () { return this; },
    del: function () { return this; },
    incrby: function () { return this; },
    set: function () { return this; },
    setex: function () { return this; },
  })) as never;
}
