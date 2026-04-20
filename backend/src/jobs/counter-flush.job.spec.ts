import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CounterFlushJob } from './counter-flush.job.js';
import { DRIZZLE } from '../database/drizzle.provider.js';
import { REDIS_AVAILABLE } from '../common/providers/redis.provider.js';

describe('CounterFlushJob', () => {
  let job: CounterFlushJob;
  let mockDb: any;
  let mockRedis: any;
  let redisStatus: { available: boolean };

  beforeEach(async () => {
    const updateChain: any = {};
    ['update', 'set', 'where'].forEach((m) => {
      updateChain[m] = vi.fn().mockReturnValue(updateChain);
    });
    updateChain.then = (resolve: any) => resolve([]);

    mockDb = { update: vi.fn().mockReturnValue(updateChain) };

    mockRedis = {
      scan: vi.fn(),
      getdel: vi.fn(),
    };

    redisStatus = { available: true };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CounterFlushJob,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: REDIS_AVAILABLE, useValue: redisStatus },
      ],
    }).compile();

    job = module.get<CounterFlushJob>(CounterFlushJob);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('flush()', () => {
    it('should skip entire flush when Redis is unavailable (C6)', async () => {
      redisStatus.available = false;

      await job.flush();

      expect(mockRedis.scan).not.toHaveBeenCalled();
      expect(mockRedis.getdel).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should complete without error when no keys exist', async () => {
      // SCAN returns empty cursor immediately
      mockRedis.scan.mockResolvedValue(['0', []]);

      await expect(job.flush()).resolves.not.toThrow();
    });

    it('should flush chapter view counter to DB', async () => {
      // SCAN returns one key then stops
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['counter:chapter:42:views']]) // chapter scan
        .mockResolvedValue(['0', []]); // other scans

      mockRedis.getdel.mockResolvedValue('5');

      await job.flush();

      expect(mockRedis.getdel).toHaveBeenCalledWith('counter:chapter:42:views');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should skip keys with zero value', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['counter:chapter:42:views']])
        .mockResolvedValue(['0', []]);

      mockRedis.getdel.mockResolvedValue('0');

      await job.flush();

      // getdel called but db.update should NOT be called (value is '0')
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should skip keys with null value', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['counter:chapter:42:views']])
        .mockResolvedValue(['0', []]);

      mockRedis.getdel.mockResolvedValue(null);

      await job.flush();

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should flush manga view counter to DB', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', []]) // chapter
        .mockResolvedValueOnce(['0', ['counter:manga:7:views']]) // manga views
        .mockResolvedValue(['0', []]);

      mockRedis.getdel.mockResolvedValue('10');

      await job.flush();

      expect(mockRedis.getdel).toHaveBeenCalledWith('counter:manga:7:views');
    });

    it('should handle errors in individual key flush gracefully', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['counter:chapter:bad:key']]) // malformed key
        .mockResolvedValue(['0', []]);

      mockRedis.getdel.mockResolvedValue('3');

      // Should not throw even if extractId returns null for malformed key
      await expect(job.flush()).resolves.not.toThrow();
    });

    it('should paginate SCAN results until cursor is 0', async () => {
      // Simulate multi-page SCAN
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['counter:chapter:1:views']]) // cursor not 0 yet
        .mockResolvedValueOnce(['0', ['counter:chapter:2:views']]) // final page
        .mockResolvedValue(['0', []]);

      mockRedis.getdel.mockResolvedValue('1');

      await job.flush();

      // scan called at least 2 times for chapter keys
      expect(mockRedis.scan.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
