import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const logger = new Logger('RedisProvider');

/** Token for injecting Redis availability flag */
export const REDIS_AVAILABLE = 'REDIS_AVAILABLE';

/** Mutable container so services can check Redis status */
export interface RedisStatus {
  available: boolean;
}

/**
 * Creates a Redis client that gracefully degrades to a no-op stub
 * when Redis is unavailable. All get/set operations silently return
 * null so the app works without caching.
 */
export function createResilientRedis(
  config: ConfigService,
  status?: RedisStatus,
): Redis {
  const url = config.get<string>('redis.url', 'redis://localhost:6379');
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 500, 2000);
    },
    lazyConnect: true,
  });

  // Store original methods so we can restore on reconnect
  const originals = saveOriginalMethods(client);

  // Try connecting; if it fails, swap to no-op stub
  client.connect().then(() => {
    if (status) status.available = true;
  }).catch(() => {
    logger.warn('Redis unavailable — running without cache');
    if (status) status.available = false;
    stubRedisClient(client);
  });

  client.on('error', () => {
    // suppress repeated connection errors
  });

  // Recovery: when Redis reconnects, restore original methods
  client.on('ready', () => {
    if (status && !status.available) {
      logger.log('Redis reconnected — restoring live client');
      restoreOriginalMethods(client, originals);
      status.available = true;
    }
  });

  return client;
}

const STUBBED_METHODS = [
  'get', 'getdel', 'set', 'setex', 'del', 'keys', 'incr', 'incrby',
  'expire', 'ttl', 'exists', 'scan', 'pipeline',
] as const;

type MethodBackup = Map<string, (...args: never[]) => unknown>;

/** Save original Redis methods before stubbing */
function saveOriginalMethods(client: Redis): MethodBackup {
  const map: MethodBackup = new Map();
  for (const m of STUBBED_METHODS) {
    map.set(m, (client as never)[m]);
  }
  return map;
}

/** Restore original Redis methods on reconnect */
function restoreOriginalMethods(client: Redis, originals: MethodBackup): void {
  for (const [method, fn] of originals) {
    (client as unknown as Record<string, unknown>)[method] = fn;
  }
}

/** Override read/write methods so they silently no-op */
function stubRedisClient(client: Redis): void {
  const noop = () => Promise.resolve(null);
  client.get = noop as never;
  client.getdel = noop as never;
  client.set = noop as never;
  client.setex = noop as never;
  client.del = noop as never;
  client.keys = (() => Promise.resolve([])) as never;
  client.incr = (() => Promise.resolve(0)) as never;
  client.incrby = (() => Promise.resolve(0)) as never;
  client.expire = noop as never;
  client.ttl = (() => Promise.resolve(-2)) as never;
  client.exists = (() => Promise.resolve(0)) as never;
  client.scan = (() => Promise.resolve(['0', []])) as never;
  client.pipeline = (() => ({
    exec: () => Promise.resolve([]),
    get: function () {
      return this;
    },
    del: function () {
      return this;
    },
    incrby: function () {
      return this;
    },
    set: function () {
      return this;
    },
    setex: function () {
      return this;
    },
  })) as never;
}
