/**
 * Single source of truth for "manga has new chapter(s) released".
 *
 * Whenever a new chapter lands (admin create, admin import API, standalone
 * crawler scripts), the manga row's denormalized chapter columns must be
 * recomputed. This helper exists so all entry points share one implementation
 * — past bugs (commit 4e777820) traced to logic drift between paths.
 *
 * Semantics:
 *  - `lastChapterId`     → newest non-deleted chapter (by `order`)
 *  - `chaptersCount`     → count of non-deleted chapters
 *  - `chapterUpdatedAt`  → time of latest chapter activity (display field)
 *  - `updatedAt`         → "new chapter release" timestamp; drives the
 *                          "recently updated" sort on listings (see 4e777820
 *                          for why this is explicit, not ORM-auto).
 */
import { eq, desc, count, and, isNull } from 'drizzle-orm';
import { chapters, manga } from '../../../database/schema/index.js';
import type { DrizzleDB } from '../../../database/drizzle.provider.js';

/**
 * Bump manga row after a chapter release. Idempotent.
 * No-op if manga has zero non-deleted chapters (preserves `lastChapterId`).
 */
export async function bumpMangaOnChapterRelease(
  db: DrizzleDB,
  mangaId: number,
): Promise<void> {
  const [latest] = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(and(eq(chapters.mangaId, mangaId), isNull(chapters.deletedAt)))
    .orderBy(desc(chapters.order))
    .limit(1);

  const [{ total }] = await db
    .select({ total: count() })
    .from(chapters)
    .where(and(eq(chapters.mangaId, mangaId), isNull(chapters.deletedAt)));

  if (total === 0) return;

  const now = new Date();
  await db
    .update(manga)
    .set({
      lastChapterId: latest?.id ?? null,
      chaptersCount: total,
      chapterUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(manga.id, mangaId));
}
