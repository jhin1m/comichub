import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FollowService } from './follow.service.js';
import { DRIZZLE } from '../../../database/drizzle.provider.js';

function buildChain(resolvedValue: any = []) {
  const chain: any = {};
  ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'insert',
    'values', 'update', 'set', 'delete', 'innerJoin'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.returning = vi.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

const mangaFixture = { id: 1, followersCount: 10 };

describe('FollowService', () => {
  let service: FollowService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: {
        follows: { findFirst: vi.fn() },
      },
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<FollowService>(FollowService);
  });

  afterEach(() => { vi.clearAllMocks(); });

  // ─── toggleFollow ─────────────────────────────────────────────────────

  describe('toggleFollow()', () => {
    it('should throw NotFoundException when manga not found', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      await expect(service.toggleFollow(10, 999)).rejects.toThrow(NotFoundException);
    });

    it('should unfollow when already following', async () => {
      mockDb.select.mockReturnValue(buildChain([mangaFixture]));
      mockDb.query.follows.findFirst.mockResolvedValue({ id: 1 });
      mockDb.delete.mockReturnValue(buildChain([]));
      mockDb.update.mockReturnValue(buildChain([{ followersCount: 9 }]));

      const result = await service.toggleFollow(10, 1);
      expect(result.followed).toBe(false);
      expect(result.followersCount).toBe(9);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should follow when not yet following', async () => {
      mockDb.select.mockReturnValue(buildChain([mangaFixture]));
      mockDb.query.follows.findFirst.mockResolvedValue(null);
      mockDb.insert.mockReturnValue(buildChain([]));
      mockDb.update.mockReturnValue(buildChain([{ followersCount: 11 }]));

      const result = await service.toggleFollow(10, 1);
      expect(result.followed).toBe(true);
      expect(result.followersCount).toBe(11);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // ─── isFollowed ───────────────────────────────────────────────────────

  describe('isFollowed()', () => {
    it('should return followed=true when follow exists', async () => {
      mockDb.query.follows.findFirst.mockResolvedValue({ id: 1 });
      const result = await service.isFollowed(10, 1);
      expect(result.followed).toBe(true);
    });

    it('should return followed=false when no follow', async () => {
      mockDb.query.follows.findFirst.mockResolvedValue(null);
      const result = await service.isFollowed(10, 999);
      expect(result.followed).toBe(false);
    });
  });

  // ─── getFollowedIds ───────────────────────────────────────────────────

  describe('getFollowedIds()', () => {
    it('should return array of manga IDs', async () => {
      mockDb.select.mockReturnValue(buildChain([{ mangaId: 1 }, { mangaId: 2 }]));
      const result = await service.getFollowedIds(10);
      expect(result).toEqual([1, 2]);
    });

    it('should return empty array when no follows', async () => {
      mockDb.select.mockReturnValue(buildChain([]));
      const result = await service.getFollowedIds(10);
      expect(result).toEqual([]);
    });
  });

  // ─── getFollows ───────────────────────────────────────────────────────

  describe('getFollows()', () => {
    it('should return paginated follow list', async () => {
      let call = 0;
      mockDb.select.mockImplementation(() => {
        call++;
        if (call === 1) return buildChain([{ cnt: 1 }]);
        return buildChain([{ id: 1, mangaId: 1, createdAt: new Date(), manga: mangaFixture }]);
      });

      const result = await service.getFollows(10, { page: 1, limit: 20, offset: 0 } as any);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should return empty list when user follows nothing', async () => {
      mockDb.select.mockReturnValue(buildChain([{ cnt: 0 }]));

      const result = await service.getFollows(10, { page: 1, limit: 20, offset: 0 } as any);
      expect(result.total).toBe(0);
    });
  });
});
