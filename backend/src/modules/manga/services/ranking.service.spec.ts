import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RankingService } from './ranking.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildSelectChain(resolvedValue: any = []) {
  const chain: any = {};
  ['select', 'from', 'where', 'orderBy', 'limit', 'offset'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

const mangaRow = {
  id: 1,
  title: 'One Piece',
  slug: 'one-piece',
  cover: null,
  status: 'ongoing',
  type: 'manga',
  views: 1000,
  chaptersCount: 100,
  averageRating: '4.5',
  updatedAt: new Date(),
};

describe('RankingService', () => {
  let service: RankingService;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn(),
      update: vi.fn(),
      $count: vi.fn().mockResolvedValue(0),
    };

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RankingService>(RankingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getRanking ────────────────────────────────────────────────────

  describe('getRanking()', () => {
    it('should return cached result when Redis has data', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([mangaRow]));

      const result = await service.getRanking('daily');

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('one-piece');
      // DB should NOT be queried when cache hit
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should query DB and cache result on cache miss for daily', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([mangaRow]));

      const result = await service.getRanking('daily');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rankings:daily',
        600,
        expect.any(String),
      );
      expect(result).toHaveLength(1);
    });

    it('should query DB for weekly ranking', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));

      await service.getRanking('weekly');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rankings:weekly',
        600,
        expect.any(String),
      );
    });

    it('should query DB for alltime ranking', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));

      await service.getRanking('alltime');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rankings:alltime',
        600,
        expect.any(String),
      );
    });

    it('should query DB for toprated ranking', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([]));

      await service.getRanking('toprated');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rankings:toprated',
        600,
        expect.any(String),
      );
    });
  });

  // ─── getHotManga ───────────────────────────────────────────────────

  describe('getHotManga()', () => {
    it('should return cached result on cache hit', async () => {
      const cached = { data: [mangaRow], total: 1, page: 1, limit: 10 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getHotManga(1, 10);

      expect(result.data).toHaveLength(1);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should query DB on cache miss and cache result', async () => {
      mockDb.select.mockReturnValue(buildSelectChain([mangaRow]));
      mockDb.$count.mockResolvedValue(1);

      const result = await service.getHotManga(1, 10);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'rankings:hot:1:10',
        3600,
        expect.any(String),
      );
      expect(result.page).toBe(1);
    });
  });
});
