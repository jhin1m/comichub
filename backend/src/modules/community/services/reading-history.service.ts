import { Injectable, Inject } from '@nestjs/common';
import { eq, sql, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { readingHistory } from '../../../database/schema/community.schema.js';
import type { PaginationDto } from '../../../common/dto/pagination.dto.js';

export interface UpsertReadingHistoryDto {
  mangaId: number;
  chapterId?: number;
}

@Injectable()
export class ReadingHistoryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async upsert(userId: number, dto: UpsertReadingHistoryDto) {
    const [result] = await this.db
      .insert(readingHistory)
      .values({
        userId,
        mangaId: dto.mangaId,
        chapterId: dto.chapterId ?? null,
        lastReadAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [readingHistory.userId, readingHistory.mangaId],
        set: {
          chapterId: dto.chapterId ?? null,
          lastReadAt: new Date(),
        },
      })
      .returning();

    return result;
  }

  async getHistory(userId: number, pagination: PaginationDto) {
    return this.db
      .select()
      .from(readingHistory)
      .where(eq(readingHistory.userId, userId))
      .orderBy(desc(readingHistory.lastReadAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
  }

  async removeEntry(userId: number, mangaId: number) {
    await this.db
      .delete(readingHistory)
      .where(
        sql`${readingHistory.userId} = ${userId} AND ${readingHistory.mangaId} = ${mangaId}`,
      );
  }
}
