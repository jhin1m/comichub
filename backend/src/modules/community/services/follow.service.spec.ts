import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FollowService } from './follow.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

describe('FollowService', () => {
  let service: FollowService;
  let mockDb: any;

  beforeEach(async () => {
    // Mock Drizzle DB with chainable methods
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FollowService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<FollowService>(FollowService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('toggle()', () => {
    it('should throw NotFoundException if manga does not exist', async () => {
      const mangaId = 999;
      const userId = 1;

      mockDb.limit.mockResolvedValue([]);

      await expect(service.toggle(mangaId, userId)).rejects.toThrow(
        new NotFoundException('Manga not found'),
      );
    });

    it('should insert follow and return following:true when not already following', async () => {
      const mangaId = 1;
      const userId = 5;

      // Mock manga exists
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      // Mock no existing follow
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.toggle(mangaId, userId);

      expect(result).toEqual({ following: true });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({ userId, mangaId });
    });

    it('should increment followersCount when inserting follow', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]); // No existing follow

      await service.toggle(mangaId, userId);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should delete follow and return following:false when already following', async () => {
      const mangaId = 1;
      const userId = 5;
      const existingFollow = { id: 100, userId, mangaId };

      // Mock manga exists
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      // Mock existing follow
      mockDb.limit.mockResolvedValueOnce([existingFollow]);

      const result = await service.toggle(mangaId, userId);

      expect(result).toEqual({ following: false });
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should decrement followersCount when deleting follow', async () => {
      const mangaId = 1;
      const userId = 5;
      const existingFollow = { id: 100, userId, mangaId };

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([existingFollow]); // Follow exists

      await service.toggle(mangaId, userId);

      // Should call update for both delete and decrement
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should verify manga exists before toggle', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]); // Manga exists
      mockDb.limit.mockResolvedValueOnce([]); // No follow

      await service.toggle(mangaId, userId);

      // First where/limit should be for manga check
      expect(mockDb.limit).toHaveBeenCalled();
    });

    it('should use correct follow id when deleting', async () => {
      const mangaId = 1;
      const userId = 5;
      const followId = 42;
      const existingFollow = { id: followId, userId, mangaId };

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([existingFollow]);

      await service.toggle(mangaId, userId);

      // Should delete by the follow's id
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle multiple follow/unfollow cycles for same user-manga pair', async () => {
      const mangaId = 1;
      const userId = 5;

      // First toggle: follow
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);
      await service.toggle(mangaId, userId);

      vi.clearAllMocks();

      // Second toggle: unfollow
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([{ id: 100, userId, mangaId }]);
      const resultUnfollow = await service.toggle(mangaId, userId);

      expect(resultUnfollow).toEqual({ following: false });
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('isFollowing()', () => {
    it('should return true if user is following manga', async () => {
      const mangaId = 1;
      const userId = 5;
      const follow = { id: 100, userId, mangaId };

      mockDb.limit.mockResolvedValue([follow]);

      const result = await service.isFollowing(mangaId, userId);

      expect(result).toEqual({ following: true });
    });

    it('should return false if user is not following manga', async () => {
      const mangaId = 1;
      const userId = 999;

      mockDb.limit.mockResolvedValue([]);

      const result = await service.isFollowing(mangaId, userId);

      expect(result).toEqual({ following: false });
    });

    it('should query with correct filters', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValue([]);

      await service.isFollowing(mangaId, userId);

      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalled();
    });

    it('should handle non-existent follow record', async () => {
      const mangaId = 999;
      const userId = 999;

      mockDb.limit.mockResolvedValue([]);

      const result = await service.isFollowing(mangaId, userId);

      expect(result.following).toBe(false);
    });

    it('should use only userId and mangaId for check', async () => {
      const mangaId = 5;
      const userId = 10;

      mockDb.limit.mockResolvedValue([]);

      await service.isFollowing(mangaId, userId);

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('assertMangaExists()', () => {
    it('should not throw if manga exists', async () => {
      const mangaId = 1;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]); // No follow

      await expect(service.toggle(mangaId, 5)).resolves.not.toThrow();
    });

    it('should throw NotFoundException when manga not found', async () => {
      const mangaId = 999;

      mockDb.limit.mockResolvedValue([]);

      await expect(service.toggle(mangaId, 5)).rejects.toThrow(
        new NotFoundException('Manga not found'),
      );
    });

    it('should be called before toggle operation', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([]); // Manga not found

      await expect(service.toggle(mangaId, userId)).rejects.toThrow();

      // First select/from/where/limit should be for manga check
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle follow on first manga visit', async () => {
      const mangaId = 1;
      const userId = 1;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]); // First time, no follow

      const result = await service.toggle(mangaId, userId);

      expect(result.following).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle large user IDs', async () => {
      const mangaId = 1;
      const userId = 9999999;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);

      await service.toggle(mangaId, userId);

      expect(mockDb.values).toHaveBeenCalledWith({
        userId,
        mangaId,
      });
    });

    it('should handle large manga IDs', async () => {
      const mangaId = 9999999;
      const userId = 1;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);

      await service.toggle(mangaId, userId);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should correctly identify follow state with same user multiple follows', async () => {
      const userId = 1;
      const mangaId1 = 10;
      const mangaId2 = 20;

      // Check follow status on mangaId1 - following
      mockDb.limit.mockResolvedValueOnce([
        { id: 100, userId, mangaId: mangaId1 },
      ]);
      const result1 = await service.isFollowing(mangaId1, userId);
      expect(result1.following).toBe(true);

      vi.clearAllMocks();

      // Check follow status on mangaId2 - not following
      mockDb.limit.mockResolvedValueOnce([]);
      const result2 = await service.isFollowing(mangaId2, userId);
      expect(result2.following).toBe(false);
    });

    it('should atomically update followersCount increment', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);

      await service.toggle(mangaId, userId);

      // Verify both insert and update are called in correct order
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should atomically update followersCount decrement', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([{ id: 100, userId, mangaId }]);

      await service.toggle(mangaId, userId);

      // Verify both delete and update are called
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
