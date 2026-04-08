/**
 * Generic in-memory cache with TTL and FIFO eviction.
 * Shared by TaxonomyService, MangaService, and any future service-level caches.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  get<U = T>(key: string): U | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.cache.delete(key);
      return null;
    }
    // Deep copy to prevent callers from mutating cached data
    return structuredClone(entry.data) as unknown as U;
  }

  set(key: string, data: T): void {
    // FIFO eviction when at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  /** Delete all keys matching the given prefix (includes exact match) */
  invalidate(prefix: string): void {
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  /** Delete keys where the key contains the given substring */
  invalidateBySubstring(substring: string): void {
    for (const key of [...this.cache.keys()]) {
      if (key.includes(substring)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
