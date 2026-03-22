import { Injectable } from '@nestjs/common';
import { FollowService as UserFollowService } from '../../user/services/follow.service.js';

/**
 * Community follow service — delegates to user module's FollowService
 * to avoid duplicate logic. Adapts return shape for community API endpoints.
 */
@Injectable()
export class FollowService {
  constructor(private readonly userFollowService: UserFollowService) {}

  async toggle(mangaId: number, userId: number) {
    const result = await this.userFollowService.toggleFollow(userId, mangaId);
    return { following: result.followed, followersCount: result.followersCount };
  }

  async isFollowing(mangaId: number, userId: number) {
    const result = await this.userFollowService.isFollowed(userId, mangaId);
    return { following: result.followed };
  }
}
