import { Injectable, Inject } from '@nestjs/common';
import { eq, and, count, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import {
  readingHistory,
  manga,
  chapters,
} from '../../../database/schema/index.js';
import type { PaginationDto } from '../../../common/dto/pagination.dto.js';
import type { UpsertHistoryDto } from '../dto/upsert-history.dto.js';
import type { HistoryItem, PaginatedResult } from '../types/user.types.js';

@Injectable()
export class HistoryService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async upsert(
    userId: number,
    dto: UpsertHistoryDto,
  ): Promise<{ message: string }> {
    const existing = await this.db.query.readingHistory.findFirst({
      where: and(
        eq(readingHistory.userId, userId),
        eq(readingHistory.mangaId, dto.mangaId),
      ),
    });

    if (existing) {
      await this.db
        .update(readingHistory)
        .set({
          chapterId: dto.chapterId ?? existing.chapterId,
          lastReadAt: new Date(),
        })
        .where(eq(readingHistory.id, existing.id));
    } else {
      await this.db.insert(readingHistory).values({
        userId,
        mangaId: dto.mangaId,
        chapterId: dto.chapterId ?? null,
        lastReadAt: new Date(),
      });
    }

    return { message: 'History updated' };
  }

  async getHistory(
    userId: number,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<HistoryItem>> {
    const { page, limit, offset } = pagination;

    const [totalRow, rows] = await Promise.all([
      this.db
        .select({ cnt: count() })
        .from(readingHistory)
        .where(eq(readingHistory.userId, userId)),
      this.db
        .select({
          id: readingHistory.id,
          mangaId: readingHistory.mangaId,
          chapterId: readingHistory.chapterId,
          lastReadAt: readingHistory.lastReadAt,
          manga: {
            id: manga.id,
            title: manga.title,
            slug: manga.slug,
            cover: manga.cover,
          },
          chapter: {
            id: chapters.id,
            number: chapters.number,
            title: chapters.title,
          },
        })
        .from(readingHistory)
        .innerJoin(manga, eq(readingHistory.mangaId, manga.id))
        .leftJoin(chapters, eq(readingHistory.chapterId, chapters.id))
        .where(eq(readingHistory.userId, userId))
        .orderBy(sql`${readingHistory.lastReadAt} desc`)
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalRow[0]?.cnt ?? 0;
    return {
      data: rows as HistoryItem[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async removeEntry(
    userId: number,
    mangaId: number,
  ): Promise<{ message: string }> {
    await this.db
      .delete(readingHistory)
      .where(
        and(
          eq(readingHistory.userId, userId),
          eq(readingHistory.mangaId, mangaId),
        ),
      );
    return { message: 'History entry removed' };
  }

  async clearAll(userId: number): Promise<{ message: string }> {
    await this.db
      .delete(readingHistory)
      .where(eq(readingHistory.userId, userId));
    return { message: 'History cleared' };
  }
}
