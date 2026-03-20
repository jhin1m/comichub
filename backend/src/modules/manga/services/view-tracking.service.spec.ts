import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ViewTrackingService } from './view-tracking.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

describe('ViewTrackingService', () => {
  let service: ViewTrackingService;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(async () => {
    // Mock Drizzle DB
    mockDb = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Redis
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
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
    it('should return early if Redis key already exists', async () => {
      const chapterId = 1;
      const userId = 10;

      mockRedis.get.mockResolvedValue('1');

      await service.trackChapterView(chapterId, userId);

      expect(mockRedis.get).toHaveBeenCalledWith(`view:${chapterId}:user:${userId}`);
      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should increment view count and set TTL when key does not exist with userId', async () => {
      const chapterId = 1;
      const userId = 10;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.trackChapterView(chapterId, userId);

      expect(mockRedis.get).toHaveBeenCalledWith(`view:${chapterId}:user:${userId}`);
      expect(mockRedis.setex).toHaveBeenCalledWith(`view:${chapterId}:user:${userId}`, 5, '1');
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should increment view count and set TTL when key does not exist with ip', async () => {
      const chapterId = 2;
      const ip = '192.168.1.1';

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.trackChapterView(chapterId, undefined, ip);

      expect(mockRedis.get).toHaveBeenCalledWith(`view:${chapterId}:ip:${ip}`);
      expect(mockRedis.setex).toHaveBeenCalledWith(`view:${chapterId}:ip:${ip}`, 5, '1');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should use unknown ip when neither userId nor ip provided', async () => {
      const chapterId = 3;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.trackChapterView(chapterId);

      expect(mockRedis.get).toHaveBeenCalledWith(`view:${chapterId}:ip:unknown`);
      expect(mockRedis.setex).toHaveBeenCalledWith(`view:${chapterId}:ip:unknown`, 5, '1');
    });

    it('should set Redis TTL to 5 seconds', async () => {
      const chapterId = 1;
      const userId = 20;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.trackChapterView(chapterId, userId);

      const calls = mockRedis.setex.mock.calls;
      expect(calls[0][1]).toBe(5); // Second argument is TTL in seconds
    });

    it('should call db.update with chapters table', async () => {
      const chapterId = 1;
      const userId = 10;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.trackChapterView(chapterId, userId);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should prioritize userId over ip when both provided', async () => {
      const chapterId = 5;
      const userId = 15;
      const ip = '10.0.0.1';

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.trackChapterView(chapterId, userId, ip);

      // Should use userId, not ip
      expect(mockRedis.get).toHaveBeenCalledWith(`view:${chapterId}:user:${userId}`);
      expect(mockRedis.setex).toHaveBeenCalledWith(`view:${chapterId}:user:${userId}`, 5, '1');
    });

    it('should handle multiple concurrent views for same chapter', async () => {
      const chapterId = 1;
      const userId1 = 10;
      const userId2 = 20;

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.trackChapterView(chapterId, userId1);
      await service.trackChapterView(chapterId, userId2);

      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
      expect(mockRedis.setex).toHaveBeenNthCalledWith(
        1,
        `view:${chapterId}:user:${userId1}`,
        5,
        '1',
      );
      expect(mockRedis.setex).toHaveBeenNthCalledWith(
        2,
        `view:${chapterId}:user:${userId2}`,
        5,
        '1',
      );
    });

    it('should handle no view increment on subsequent calls within TTL', async () => {
      const chapterId = 1;
      const userId = 10;

      // First call: key doesn't exist
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.trackChapterView(chapterId, userId);
      expect(mockDb.update).toHaveBeenCalledTimes(1);

      // Second call: key exists (within TTL)
      mockRedis.get.mockResolvedValueOnce('1');

      await service.trackChapterView(chapterId, userId);
      expect(mockDb.update).toHaveBeenCalledTimes(1); // Still called only once
    });
  });
});
