import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FollowService } from './follow.service.js';
import { FollowService as UserFollowService } from '../../user/services/follow.service.js';

describe('FollowService (community delegate)', () => {
  let service: FollowService;
  let mockUserFollowService: any;

  beforeEach(async () => {
    mockUserFollowService = {
      toggleFollow: vi.fn(),
      isFollowed: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowService,
        { provide: UserFollowService, useValue: mockUserFollowService },
      ],
    }).compile();

    service = module.get<FollowService>(FollowService);
  });

  describe('toggle()', () => {
    it('should delegate to userFollowService.toggleFollow and adapt response', async () => {
      mockUserFollowService.toggleFollow.mockResolvedValue({
        followed: true,
        followersCount: 5,
      });

      const result = await service.toggle(1, 10);

      expect(mockUserFollowService.toggleFollow).toHaveBeenCalledWith(10, 1);
      expect(result).toEqual({ following: true, followersCount: 5 });
    });

    it('should return following:false when unfollowing', async () => {
      mockUserFollowService.toggleFollow.mockResolvedValue({
        followed: false,
        followersCount: 4,
      });

      const result = await service.toggle(1, 10);
      expect(result).toEqual({ following: false, followersCount: 4 });
    });

    it('should propagate NotFoundException from user service', async () => {
      mockUserFollowService.toggleFollow.mockRejectedValue(
        new NotFoundException('Manga not found'),
      );

      await expect(service.toggle(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  describe('isFollowing()', () => {
    it('should delegate to userFollowService.isFollowed and adapt response', async () => {
      mockUserFollowService.isFollowed.mockResolvedValue({ followed: true });

      const result = await service.isFollowing(1, 10);

      expect(mockUserFollowService.isFollowed).toHaveBeenCalledWith(10, 1);
      expect(result).toEqual({ following: true });
    });

    it('should return following:false when not followed', async () => {
      mockUserFollowService.isFollowed.mockResolvedValue({ followed: false });

      const result = await service.isFollowing(1, 10);
      expect(result).toEqual({ following: false });
    });
  });
});
