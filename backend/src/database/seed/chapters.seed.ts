import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index.js';
import type { SeededManga } from './manga.seed.js';

export type SeededChapter = { id: number; mangaId: number };

const IMAGES_PER_CHAPTER = 8;

export async function seedChapters(
  db: PostgresJsDatabase<typeof schema>,
  mangaList: SeededManga[],
): Promise<SeededChapter[]> {
  const allChapters: SeededChapter[] = [];

  for (const m of mangaList) {
    for (let chNum = 1; chNum <= 3; chNum++) {
      const slug = `chapter-${chNum}`;
      const [ch] = await db
        .insert(schema.chapters)
        .values({
          mangaId: m.id,
          number: String(chNum),
          title: `Chapter ${chNum}`,
          slug,
          viewCount: Math.floor(Math.random() * 20000) + 100,
          order: chNum,
        })
        .onConflictDoNothing()
        .returning({
          id: schema.chapters.id,
          mangaId: schema.chapters.mangaId,
        });

      if (!ch) continue;
      allChapters.push(ch);

      // Chapter images (pages)
      const images = Array.from({ length: IMAGES_PER_CHAPTER }, (_, i) => ({
        chapterId: ch.id,
        imageUrl: `https://picsum.photos/seed/${m.slug}-ch${chNum}-p${i + 1}/800/1200`,
        pageNumber: i + 1,
        order: i + 1,
      }));
      await db
        .insert(schema.chapterImages)
        .values(images)
        .onConflictDoNothing();
    }

    // Update manga.lastChapterId to the last inserted chapter for this manga
    const lastCh = allChapters.filter((c) => c.mangaId === m.id).at(-1);
    if (lastCh) {
      await db
        .update(schema.manga)
        .set({ lastChapterId: lastCh.id })
        .where(eq(schema.manga.id, m.id));
    }
  }

  const totalImages = allChapters.length * IMAGES_PER_CHAPTER;
  console.log(
    `  ✓ ${allChapters.length} chapters, ${totalImages} chapter images`,
  );
  return allChapters;
}
