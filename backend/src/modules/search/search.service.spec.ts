import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service.js';
import { DRIZZLE } from '../../database/drizzle.provider.js';

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
    mockDb = {
      select: vi.fn(),
      $count: vi.fn().mockResolvedValue(0),
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
      const manga = [{ id: 1, title: 'Naruto', slug: 'naruto' }];
      mockDb.select.mockReturnValue(buildSelectChain(manga));
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
        genre: 'action',
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

    it('should sort by views when sort=views', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await expect(
        service.search({
          q: 'test',
          sort: 'views' as any,
          page: 1,
          limit: 10,
          offset: 0,
        }),
      ).resolves.not.toThrow();
    });

    it('should sort by rating when sort=rating', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await expect(
        service.search({
          q: 'test',
          sort: 'rating' as any,
          page: 1,
          limit: 10,
          offset: 0,
        }),
      ).resolves.not.toThrow();
    });

    it('should sort by createdAt when sort=created_at', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));
      mockDb.$count.mockResolvedValue(0);

      await expect(
        service.search({
          q: 'test',
          sort: 'created_at' as any,
          page: 1,
          limit: 10,
          offset: 0,
        }),
      ).resolves.not.toThrow();
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

    it('should query DB and cache on cache miss', async () => {
      const rows = [
        { id: 1, title: 'One Piece', slug: 'one-piece', cover: null },
      ];
      mockDb.select.mockReturnValue(buildSelectChain(rows));

      const result = await service.suggest('one');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'suggest:one',
        300,
        expect.any(String),
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no manga matches suggestion', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));

      const result = await service.suggest('xyznonexistent');

      expect(result).toEqual([]);
    });
  });
});
