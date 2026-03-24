import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ViewCounterResetJob } from './view-counter-reset.job.js';
import { DRIZZLE } from '../database/drizzle.provider.js';

describe('ViewCounterResetJob', () => {
  let job: ViewCounterResetJob;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(async () => {
    const updateChain: any = {};
    ['update', 'set'].forEach((m) => {
      updateChain[m] = vi.fn().mockReturnValue(updateChain);
    });
    updateChain.then = (resolve: any) => resolve([]);

    mockDb = { update: vi.fn().mockReturnValue(updateChain) };

    mockRedis = {
      scan: vi.fn().mockResolvedValue(['0', []]),
      del: vi.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewCounterResetJob,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    job = module.get<ViewCounterResetJob>(ViewCounterResetJob);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('resetDailyViews()', () => {
    it('should reset viewsDay column without throwing', async () => {
      await expect(job.resetDailyViews()).resolves.not.toThrow();
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it('should invalidate ranking caches after reset', async () => {
      mockRedis.scan.mockResolvedValue([
        '0',
        ['rankings:day', 'rankings:week'],
      ]);

      await job.resetDailyViews();

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'rankings:*',
        'COUNT',
        100,
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'rankings:day',
        'rankings:week',
      );
    });

    it('should skip del when no ranking cache keys exist', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await job.resetDailyViews();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('resetWeeklyViews()', () => {
    it('should reset viewsWeek column without throwing', async () => {
      await expect(job.resetWeeklyViews()).resolves.not.toThrow();
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it('should invalidate ranking caches after weekly reset', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['rankings:week']]);

      await job.resetWeeklyViews();

      expect(mockRedis.del).toHaveBeenCalledWith('rankings:week');
    });
  });

  describe('flushViewCounters()', () => {
    it('should invalidate ranking caches without throwing', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['rankings:day']]);

      await expect(job.flushViewCounters()).resolves.not.toThrow();
      expect(mockRedis.del).toHaveBeenCalledOnce();
    });

    it('should handle empty cache gracefully', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      await expect(job.flushViewCounters()).resolves.not.toThrow();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
