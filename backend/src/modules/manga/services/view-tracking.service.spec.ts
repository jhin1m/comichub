import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ViewTrackingService } from './view-tracking.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

describe('ViewTrackingService', () => {
  let service: ViewTrackingService;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(async () => {
    // Chainable select mock — returns empty chapter by default
    const selectChain: any = {};
    ['select', 'from', 'where', 'limit'].forEach((m) => {
      selectChain[m] = vi.fn().mockReturnValue(selectChain);
    });
    selectChain.then = (resolve: any) => resolve([{ mangaId: 1 }]);

    mockDb = { select: vi.fn().mockReturnValue(selectChain) };

    mockRedis = {
      get: vi.fn(),
      setex: vi.fn().mockResolvedValue('OK'),
      incr: vi.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewTrackingService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ViewTrackingService>(ViewTrackingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('trackChapterView()', () => {
    it('should return early when Redis dedup key already exists', async () => {
      mockRedis.get.mockResolvedValue('1');

      await service.trackChapterView(1, 10);

      expect(mockRedis.get).toHaveBeenCalledWith('view:1:user:10');
      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(mockRedis.incr).not.toHaveBeenCalled();
    });

    it('should set dedup key and increment counters for userId', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.trackChapterView(1, 10);

      expect(mockRedis.setex).toHaveBeenCalledWith('view:1:user:10', 300, '1');
      expect(mockRedis.incr).toHaveBeenCalledWith('counter:chapter:1:views');
    });

    it('should use ip identifier when userId is not provided', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.trackChapterView(2, undefined, '192.168.1.1');

      expect(mockRedis.get).toHaveBeenCalledWith('view:2:ip:192.168.1.1');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'view:2:ip:192.168.1.1',
        300,
        '1',
      );
    });

    it('should fall back to "unknown" when neither userId nor ip is provided', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.trackChapterView(3);

      expect(mockRedis.get).toHaveBeenCalledWith('view:3:ip:unknown');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'view:3:ip:unknown',
        300,
        '1',
      );
    });

    it('should set dedup TTL to 300 seconds', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.trackChapterView(1, 20);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        300,
        '1',
      );
    });

    it('should increment manga-level counters when chapter exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.trackChapterView(1, 10);

      // chapter select resolves to { mangaId: 1 } — manga counters should be incremented
      expect(mockRedis.incr).toHaveBeenCalledWith('counter:manga:1:views_day');
      expect(mockRedis.incr).toHaveBeenCalledWith('counter:manga:1:views_week');
      expect(mockRedis.incr).toHaveBeenCalledWith('counter:manga:1:views');
    });

    it('should prioritize userId over ip when both provided', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.trackChapterView(5, 15, '10.0.0.1');

      expect(mockRedis.get).toHaveBeenCalledWith('view:5:user:15');
    });

    it('should not increment counters on second call within TTL window', async () => {
      mockRedis.get.mockResolvedValueOnce(null); // first call: not seen
      await service.trackChapterView(1, 10);
      const incrAfterFirst = mockRedis.incr.mock.calls.length;

      mockRedis.get.mockResolvedValueOnce('1'); // second call: already seen
      await service.trackChapterView(1, 10);

      // incr should not have been called again
      expect(mockRedis.incr).toHaveBeenCalledTimes(incrAfterFirst);
    });

    it('should handle two different users viewing the same chapter', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.trackChapterView(1, 10);
      await service.trackChapterView(1, 20);

      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
      expect(mockRedis.setex).toHaveBeenNthCalledWith(
        1,
        'view:1:user:10',
        300,
        '1',
      );
      expect(mockRedis.setex).toHaveBeenNthCalledWith(
        2,
        'view:1:user:20',
        300,
        '1',
      );
    });
  });
});
