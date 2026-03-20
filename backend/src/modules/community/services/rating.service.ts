import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { ratings } from '../../../database/schema/community.schema.js';
import { manga } from '../../../database/schema/manga.schema.js';
import { CreateRatingDto } from '../dto/create-rating.dto.js';

@Injectable()
export class RatingService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async upsert(mangaId: number, userId: number, dto: CreateRatingDto) {
    await this.assertMangaExists(mangaId);

    await this.db
      .insert(ratings)
      .values({ userId, mangaId, score: String(dto.score) })
      .onConflictDoUpdate({
        target: [ratings.userId, ratings.mangaId],
        set: { score: String(dto.score) },
      });

    await this.recalcAverage(mangaId);

    return this.getUserRating(mangaId, userId);
  }

  async getUserRating(mangaId: number, userId: number) {
    const [rating] = await this.db
      .select()
      .from(ratings)
      .where(eq(ratings.mangaId, mangaId))
      .limit(1);

    // filter by userId using and()
    const [userRating] = await this.db
      .select()
      .from(ratings)
      .where(sql`${ratings.userId} = ${userId} AND ${ratings.mangaId} = ${mangaId}`)
      .limit(1);

    void rating;
    return userRating ?? null;
  }

  async remove(mangaId: number, userId: number) {
    const [existing] = await this.db
      .select()
      .from(ratings)
      .where(sql`${ratings.userId} = ${userId} AND ${ratings.mangaId} = ${mangaId}`)
      .limit(1);

    if (!existing) throw new NotFoundException('Rating not found');

    await this.db
      .delete(ratings)
      .where(sql`${ratings.userId} = ${userId} AND ${ratings.mangaId} = ${mangaId}`);

    await this.recalcAverage(mangaId);
  }

  private async recalcAverage(mangaId: number) {
    await this.db
      .update(manga)
      .set({
        averageRating: sql`(SELECT COALESCE(AVG(score::numeric), 0) FROM ratings WHERE manga_id = ${mangaId})`,
        totalRatings: sql`(SELECT COUNT(*) FROM ratings WHERE manga_id = ${mangaId})`,
      })
      .where(eq(manga.id, mangaId));
  }

  private async assertMangaExists(mangaId: number) {
    const [m] = await this.db
      .select({ id: manga.id })
      .from(manga)
      .where(eq(manga.id, mangaId))
      .limit(1);

    if (!m) throw new NotFoundException('Manga not found');
  }
}
