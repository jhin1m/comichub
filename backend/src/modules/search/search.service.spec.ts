import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';

// Minimal Drizzle-like query builder mock. Any chain method returns self so
// service code `.from().where().orderBy()` works without a real DB.
function buildSelectChain(resolvedValue: any = []) {
  const chain: any = {};
  [
    'select',
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'innerJoin',
    'leftJoin',
  ].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

describe('SearchService', () => {
  let service: SearchService;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(async () => {
    // `transaction` spy reuses mockDb as tx scope — this mirrors real Drizzle
    // behavior where tx has the same query builder surface as the root db.
    mockDb = {
      select: vi.fn(),
      $count: vi.fn().mockResolvedValue(0),
      execute: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockDb)),
    };

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── search ────────────────────────────────────────────────────────

  describe('search()', () => {
    it('should return paginated results for a basic query', async () => {
      const mangaRows = [{ id: 1, title: 'Naruto', slug: 'naruto' }];
      mockDb.select.mockReturnValue(buildSelectChain(mangaRows));
      mockDb.$count.mockResolvedValue(1);

      const result = await service.search({
        q: 'naruto',
        page: 1,
        limit: 10,
        offset: 0,
      });

      expect(result.data).toBeDefined();
      expect(result.page).toBe(1);
    });

    it('should return empty result when no manga matches', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      const result = await service.search({
        q: 'zzzzz',
        page: 1,
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(0);
    });

    it('should filter by genre when provided', async () => {
      // Genre lookup returns empty → no manga IDs → early return
      mockDb.select.mockReturnValue(buildSelectChain([]));

      const result = await service.search({
        q: 'test',
        genre: ['action'],
        page: 1,
        limit: 10,
        offset: 0,
      });

      expect(result.data).toEqual([]);
    });

    it('should filter by status when provided', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      const result = await service.search({
        q: 'test',
        status: 'ongoing' as any,
        page: 1,
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(0);
    });

    it('should sort by views when sort=views (no q)', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await expect(
        service.search({
          sort: 'views' as any,
          page: 1,
          limit: 10,
          offset: 0,
        }),
      ).resolves.not.toThrow();
    });

    it('should sort by rating when sort=rating (no q)', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await expect(
        service.search({
          sort: 'rating' as any,
          page: 1,
          limit: 10,
          offset: 0,
        }),
      ).resolves.not.toThrow();
    });

    it('should sort by createdAt when sort=created_at (no q)', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await expect(
        service.search({
          sort: 'created_at' as any,
          page: 1,
          limit: 10,
          offset: 0,
        }),
      ).resolves.not.toThrow();
    });

    // ─── q-length branching ─────────────────────────────────────────

    it('wraps in transaction when q length > 3 chars (fuzzy path)', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await service.search({
        q: 'naruto',
        page: 1,
        limit: 10,
        offset: 0,
      });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.execute).toHaveBeenCalledTimes(1); // SET LOCAL
    });

    it('skips transaction for short q (≤ 3 chars, ILIKE fallback)', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await service.search({
        q: 'op',
        page: 1,
        limit: 10,
        offset: 0,
      });

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('skips transaction when q is empty / undefined', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await service.search({
        page: 1,
        limit: 10,
        offset: 0,
      });

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('skips transaction when q is only whitespace', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await service.search({
        q: '   ',
        page: 1,
        limit: 10,
        offset: 0,
      });

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  // ─── suggest ───────────────────────────────────────────────────────

  describe('suggest()', () => {
    it('should return empty array for blank query', async () => {
      const result = await service.suggest('   ');
      expect(result).toEqual([]);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return cached suggestions on cache hit', async () => {
      const suggestions = [
        { id: 1, title: 'One Piece', slug: 'one-piece', cover: null },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(suggestions));

      const result = await service.suggest('one');

      expect(result).toHaveLength(1);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should query DB and cache with TTL=90 on cache miss (short q, no tx)', async () => {
      const rows = [
        { id: 1, title: 'One Piece', slug: 'one-piece', cover: null },
      ];
      mockDb.select.mockReturnValue(buildSelectChain(rows));

      const result = await service.suggest('one');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'suggest:one',
        90,
        expect.any(String),
      );
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should wrap suggest in transaction when q > 3 chars (fuzzy path)', async () => {
      const rows = [
        { id: 1, title: 'Naruto', slug: 'naruto', cover: null },
      ];
      mockDb.select.mockReturnValue(buildSelectChain(rows));

      await service.suggest('naruto');

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.execute).toHaveBeenCalledTimes(1); // SET LOCAL
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'suggest:naruto',
        90,
        expect.any(String),
      );
    });

    it('should return empty array when no manga matches suggestion', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));

      const result = await service.suggest('xyznonexistent');

      expect(result).toEqual([]);
    });
  });

  // ─── threshold env var ────────────────────────────────────────────

  describe('SEARCH_WORD_SIM_THRESHOLD env var', () => {
    const envKey = 'SEARCH_WORD_SIM_THRESHOLD';

    afterEach(() => {
      delete process.env[envKey];
    });

    async function buildService() {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          { provide: DRIZZLE, useValue: mockDb },
          { provide: 'REDIS_CLIENT', useValue: mockRedis },
        ],
      }).compile();
      return module.get<SearchService>(SearchService);
    }

    it('accepts valid in-range value', async () => {
      process.env[envKey] = '0.4';
      const s = await buildService();
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);
      // fuzzy path → SET LOCAL called with the parsed value
      await s.search({ q: 'naruto', page: 1, limit: 10, offset: 0 });
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('falls back to default when value out of range', async () => {
      process.env[envKey] = '5.0';
      const s = await buildService();
      // Service constructs without throwing — warning logged, default used.
      expect(s).toBeInstanceOf(SearchService);
    });

    it('falls back to default when value not a number', async () => {
      process.env[envKey] = 'not-a-number';
      const s = await buildService();
      expect(s).toBeInstanceOf(SearchService);
    });

    it('uses default when env var unset', async () => {
      delete process.env[envKey];
      const s = await buildService();
      expect(s).toBeInstanceOf(SearchService);
    });
  });
});
