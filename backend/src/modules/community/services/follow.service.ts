import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.provider.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';
import { follows } from '../../../database/schema/community.schema.js';
import { manga } from '../../../database/schema/manga.schema.js';

@Injectable()
export class FollowService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async toggle(mangaId: number, userId: number) {
    await this.assertMangaExists(mangaId);

    const [existing] = await this.db
      .select()
      .from(follows)
      .where(sql`${follows.userId} = ${userId} AND ${follows.mangaId} = ${mangaId}`)
      .limit(1);

    if (existing) {
      await this.db
        .delete(follows)
        .where(eq(follows.id, existing.id));

      await this.db
        .update(manga)
        .set({ followersCount: sql`${manga.followersCount} - 1` })
        .where(eq(manga.id, mangaId));

      return { following: false };
    }

    await this.db.insert(follows).values({ userId, mangaId });

    await this.db
      .update(manga)
      .set({ followersCount: sql`${manga.followersCount} + 1` })
      .where(eq(manga.id, mangaId));

    return { following: true };
  }

  async isFollowing(mangaId: number, userId: number) {
    const [existing] = await this.db
      .select()
      .from(follows)
      .where(sql`${follows.userId} = ${userId} AND ${follows.mangaId} = ${mangaId}`)
      .limit(1);

    return { following: !!existing };
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
