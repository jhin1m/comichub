import {
  Injectable,
  Inject,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { eq, and, count, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { follows, manga } from '../../../database/schema/index.js';
import type { PaginationDto } from '../../../common/dto/pagination.dto.js';
import type { FollowItem, PaginatedResult } from '../types/user.types.js';
import { BookmarkService } from '../../bookmark/services/bookmark.service.js';

@Injectable()
export class FollowService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(forwardRef(() => BookmarkService))
    private readonly bookmarkService: BookmarkService,
  ) {}

  async toggleFollow(
    userId: number,
    mangaId: number,
  ): Promise<{ followed: boolean; followersCount: number }> {
    const [mangaRow] = await this.db
      .select({ id: manga.id, followersCount: manga.followersCount })
      .from(manga)
      .where(eq(manga.id, mangaId));

    if (!mangaRow) throw new NotFoundException('Manga not found');

    const existing = await this.db.query.follows.findFirst({
      where: and(eq(follows.userId, userId), eq(follows.mangaId, mangaId)),
    });

    if (existing) {
      const result = await this.bookmarkService.removeBookmark(userId, mangaId);
      return { followed: false, followersCount: result.followersCount };
    }

    const result = await this.bookmarkService.addBookmark(userId, mangaId);
    return { followed: true, followersCount: result.followersCount };
  }

  async isFollowed(
    userId: number,
    mangaId: number,
  ): Promise<{ followed: boolean }> {
    const row = await this.db.query.follows.findFirst({
      where: and(eq(follows.userId, userId), eq(follows.mangaId, mangaId)),
    });
    return { followed: !!row };
  }

  async getFollowedIds(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ mangaId: follows.mangaId })
      .from(follows)
      .where(eq(follows.userId, userId));
    return rows.map((r) => r.mangaId);
  }

  async getFollows(
    userId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<FollowItem>> {
    const { page, limit, offset } = pagination;

    const [totalRow, rows] = await Promise.all([
      this.db
        .select({ cnt: count() })
        .from(follows)
        .where(eq(follows.userId, userId)),
      this.db
        .select({
          id: follows.id,
          mangaId: follows.mangaId,
          folderId: follows.folderId,
          createdAt: follows.createdAt,
          manga: {
            id: manga.id,
            title: manga.title,
            slug: manga.slug,
            cover: manga.cover,
            status: manga.status,
            followersCount: manga.followersCount,
          },
        })
        .from(follows)
        .innerJoin(manga, eq(follows.mangaId, manga.id))
        .where(eq(follows.userId, userId))
        .orderBy(sql`${follows.createdAt} desc`)
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalRow[0]?.cnt ?? 0;
    return {
      data: rows as FollowItem[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
