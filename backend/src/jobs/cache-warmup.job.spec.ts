import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CacheWarmupJob } from './cache-warmup.job.js';
import { RankingService } from '../modules/manga/services/ranking.service.js';
import { TaxonomyService } from '../modules/manga/services/taxonomy.service.js';

describe('CacheWarmupJob', () => {
  let job: CacheWarmupJob;
  let mockRankingService: any;
  let mockTaxonomyService: any;

  beforeEach(async () => {
    mockRankingService = { getRanking: vi.fn().mockResolvedValue([]) };
    mockTaxonomyService = { findAll: vi.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheWarmupJob,
        { provide: RankingService, useValue: mockRankingService },
        { provide: TaxonomyService, useValue: mockTaxonomyService },
      ],
    }).compile();

    job = module.get<CacheWarmupJob>(CacheWarmupJob);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onApplicationBootstrap()', () => {
    it('should warm all ranking types and genres without throwing', async () => {
      await expect(job.onApplicationBootstrap()).resolves.not.toThrow();

      expect(mockRankingService.getRanking).toHaveBeenCalledWith('daily');
      expect(mockRankingService.getRanking).toHaveBeenCalledWith('weekly');
      expect(mockRankingService.getRanking).toHaveBeenCalledWith('alltime');
      expect(mockRankingService.getRanking).toHaveBeenCalledWith('toprated');
      expect(mockTaxonomyService.findAll).toHaveBeenCalledWith('genres');
    });

    it('should not throw when a dependency fails (non-blocking warmup)', async () => {
      mockRankingService.getRanking.mockRejectedValue(
        new Error('Redis unavailable'),
      );

      await expect(job.onApplicationBootstrap()).resolves.not.toThrow();
    });
  });
});
