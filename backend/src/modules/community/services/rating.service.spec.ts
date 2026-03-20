import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RatingService } from './rating.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { CreateRatingDto } from '../dto/create-rating.dto.js';

describe('RatingService', () => {
  let service: RatingService;
  let mockDb: any;

  beforeEach(async () => {
    // Mock Drizzle DB with chainable methods
    mockDb = {
      query: {
        users: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<RatingService>(RatingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('upsert()', () => {
    it('should throw NotFoundException if manga does not exist', async () => {
      const mangaId = 999;
      const userId = 1;
      const dto: CreateRatingDto = { score: 4.5 };

      mockDb.limit.mockResolvedValue([]);

      await expect(service.upsert(mangaId, userId, dto)).rejects.toThrow(
        new NotFoundException('Manga not found'),
      );
    });

    it('should insert new rating when not exists', async () => {
      const mangaId = 1;
      const userId = 5;
      const dto: CreateRatingDto = { score: 4.5 };

      // Mock manga exists
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      // Mock no existing rating
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock getUserRating returns the new rating
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '4.5' }]);

      await service.upsert(mangaId, userId, dto);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        userId,
        mangaId,
        score: String(dto.score),
      });
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should update existing rating on conflict', async () => {
      const mangaId = 1;
      const userId = 5;
      const dto: CreateRatingDto = { score: 3.0 };

      // Mock manga exists
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      // Mock existing rating
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '4.5' }]);
      // Mock getUserRating after upsert
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '3.0' }]);

      await service.upsert(mangaId, userId, dto);

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith({
        target: expect.any(Array),
        set: { score: String(dto.score) },
      });
    });

    it('should call recalcAverage after upsert', async () => {
      const mangaId = 1;
      const userId = 5;
      const dto: CreateRatingDto = { score: 4.5 };

      // Mock manga exists
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      // Mock no existing rating
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock getUserRating
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '4.5' }]);

      await service.upsert(mangaId, userId, dto);

      // Check that update was called (from recalcAverage)
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should return user rating after upsert', async () => {
      const mangaId = 1;
      const userId = 5;
      const dto: CreateRatingDto = { score: 4.5 };
      const expectedRating = { id: 1, userId, mangaId, score: '4.5' };

      // Mock manga exists
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      // Mock no existing rating
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock getUserRating returns the new rating
      mockDb.limit.mockResolvedValueOnce([expectedRating]);

      const result = await service.upsert(mangaId, userId, dto);

      expect(result).toEqual(expectedRating);
    });

    it('should convert score to string in database', async () => {
      const mangaId = 1;
      const userId = 5;
      const dto: CreateRatingDto = { score: 4.5 };

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '4.5' }]);

      await service.upsert(mangaId, userId, dto);

      expect(mockDb.values).toHaveBeenCalledWith({
        userId,
        mangaId,
        score: '4.5',
      });
    });

    it('should handle decimal ratings correctly', async () => {
      const mangaId = 1;
      const userId = 5;
      const dto: CreateRatingDto = { score: 2.5 };

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '2.5' }]);

      await service.upsert(mangaId, userId, dto);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ score: '2.5' }),
      );
    });
  });

  describe('getUserRating()', () => {
    it('should return user rating for given manga', async () => {
      const mangaId = 1;
      const userId = 5;
      const expectedRating = { id: 1, userId, mangaId, score: '4.5' };

      mockDb.limit.mockResolvedValueOnce([{ id: 1 }]); // First query in method
      mockDb.limit.mockResolvedValueOnce([expectedRating]); // Second query for user rating

      const result = await service.getUserRating(mangaId, userId);

      expect(result).toEqual(expectedRating);
    });

    it('should return null if no rating exists for user', async () => {
      const mangaId = 1;
      const userId = 999;

      mockDb.limit.mockResolvedValueOnce([{ id: 1 }]); // Manga exists
      mockDb.limit.mockResolvedValueOnce([]); // No user rating

      const result = await service.getUserRating(mangaId, userId);

      expect(result).toBeNull();
    });

    it('should query with correct filters', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockDb.limit.mockResolvedValueOnce([]);

      await service.getUserRating(mangaId, userId);

      // Should call where with userId and mangaId filter
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('should throw NotFoundException if rating does not exist', async () => {
      const mangaId = 1;
      const userId = 999;

      mockDb.limit.mockResolvedValueOnce([]); // No rating found

      await expect(service.remove(mangaId, userId)).rejects.toThrow(
        new NotFoundException('Rating not found'),
      );
    });

    it('should delete existing rating', async () => {
      const mangaId = 1;
      const userId = 5;
      const existingRating = { id: 1, userId, mangaId, score: '4.5' };

      mockDb.limit.mockResolvedValueOnce([existingRating]); // Rating exists

      await service.remove(mangaId, userId);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should recalculate average after delete', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '4.5' }]);

      await service.remove(mangaId, userId);

      // Should call update for recalcAverage
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should delete with correct filters', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '4.5' }]);

      await service.remove(mangaId, userId);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('recalcAverage()', () => {
    it('should update manga average rating and total ratings', async () => {
      const mangaId = 1;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]); // manga exists check

      // Call through upsert to trigger recalcAverage
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId: 5, mangaId, score: '4.5' }]);

      await service.upsert(mangaId, 5, { score: 4.5 });

      // Verify update was called
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should be called after successful upsert', async () => {
      const mangaId = 1;
      const userId = 5;

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '4.5' }]);

      await service.upsert(mangaId, userId, { score: 4.5 });

      // update should be called for recalcAverage
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle minimum rating score', async () => {
      const mangaId = 1;
      const userId = 5;
      const dto: CreateRatingDto = { score: 0.5 };

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '0.5' }]);

      await service.upsert(mangaId, userId, dto);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ score: '0.5' }),
      );
    });

    it('should handle maximum rating score', async () => {
      const mangaId = 1;
      const userId = 5;
      const dto: CreateRatingDto = { score: 5.0 };

      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '5' }]);

      await service.upsert(mangaId, userId, dto);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ score: '5' }),
      );
    });

    it('should allow re-rating by same user', async () => {
      const mangaId = 1;
      const userId = 5;
      const oldDto: CreateRatingDto = { score: 3.0 };
      const newDto: CreateRatingDto = { score: 4.5 };

      // First rating
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '3.0' }]);

      await service.upsert(mangaId, userId, oldDto);

      vi.clearAllMocks();

      // Re-rating (update)
      mockDb.limit.mockResolvedValueOnce([{ id: mangaId }]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '3.0' }]);
      mockDb.limit.mockResolvedValueOnce([{ id: 1, userId, mangaId, score: '4.5' }]);

      await service.upsert(mangaId, userId, newDto);

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    });
  });
});
