/**
 * Seed: Import chapters for all WeebDex-sourced manga.
 * Usage: cd backend && npx tsx src/database/seed/import-chapters.seed.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import * as schema from '../schema/index.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const BASE_URL = 'https://api.weebdex.org';
let lastReq = 0;

interface WDChapter {
  id: string;
  title?: string;
  volume?: string;
  chapter?: string;
  language: string;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 500);
}

async function throttledFetch<T>(path: string): Promise<T> {
  const now = Date.now();
  if (now - lastReq < 210) await new Promise((r) => setTimeout(r, 210 - (now - lastReq)));
  lastReq = Date.now();
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

async function fetchAllChapters(externalMangaId: string): Promise<WDChapter[]> {
  const all: WDChapter[] = [];
  let page = 1;
  while (true) {
    const data = await throttledFetch<{ data: WDChapter[]; total: number }>(
      `/manga/${externalMangaId}/chapters?limit=100&page=${page}`,
    );
    all.push(...data.data);
    if (all.length >= data.total || data.data.length === 0) break;
    page++;
  }
  return all;
}

async function importChaptersForManga(
  mangaId: number,
  mangaTitle: string,
  externalMangaId: string,
): Promise<number> {
  const chapters = await fetchAllChapters(externalMangaId);
  if (!chapters.length) return 0;

  // Filter to 'en' only, deduplicate by chapter number
  const seen = new Set<string>();
  const filtered: WDChapter[] = [];
  for (const ch of chapters) {
    if (ch.language !== 'en') continue;
    const key = `${ch.chapter ?? '0'}-${ch.language}`;
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(ch);
  }

  // Sort by chapter number
  filtered.sort((a, b) => parseFloat(a.chapter ?? '0') - parseFloat(b.chapter ?? '0'));

  let inserted = 0;
  for (let i = 0; i < filtered.length; i++) {
    const ch = filtered[i];
    const chNum = ch.chapter ?? '0';
    const chSlug = `chapter-${chNum}`;

    // Check if already exists
    const [existing] = await db.select({ id: schema.chapters.id })
      .from(schema.chapters)
      .where(
        and(
          eq(schema.chapters.mangaId, mangaId),
          eq(schema.chapters.number, chNum),
          eq(schema.chapters.language, 'en'),
        ),
      ).limit(1);
    if (existing) continue;

    // Check slug conflict
    const [slugConflict] = await db.select({ id: schema.chapters.id })
      .from(schema.chapters)
      .where(and(eq(schema.chapters.mangaId, mangaId), eq(schema.chapters.slug, chSlug)))
      .limit(1);
    const finalSlug = slugConflict ? `${chSlug}-${Date.now()}` : chSlug;

    try {
      const [row] = await db.insert(schema.chapters).values({
        mangaId,
        number: chNum,
        title: ch.title ?? null,
        slug: finalSlug,
        language: 'en',
        volume: ch.volume ?? null,
        order: i + 1,
      }).returning({ id: schema.chapters.id });

      // Track source
      await db.insert(schema.chapterSources).values({
        chapterId: row.id,
        source: 'weebdex' as any,
        externalId: ch.id,
      }).onConflictDoNothing();

      inserted++;
    } catch (err) {
      // Skip duplicates silently
    }
  }

  // Update manga counters
  if (inserted > 0) {
    const lastCh = filtered[filtered.length - 1];
    const [lastInserted] = await db.select({ id: schema.chapters.id })
      .from(schema.chapters)
      .where(and(eq(schema.chapters.mangaId, mangaId), eq(schema.chapters.number, lastCh.chapter ?? '0')))
      .limit(1);

    await db.update(schema.manga).set({
      chaptersCount: filtered.length,
      lastChapterId: lastInserted?.id ?? null,
      chapterUpdatedAt: new Date(),
    }).where(eq(schema.manga.id, mangaId));
  }

  return inserted;
}

async function main() {
  // Get all weebdex manga sources
  const sources = await db.select({
    mangaId: schema.mangaSources.mangaId,
    externalId: schema.mangaSources.externalId,
    title: schema.manga.title,
  })
    .from(schema.mangaSources)
    .innerJoin(schema.manga, eq(schema.manga.id, schema.mangaSources.mangaId))
    .where(eq(schema.mangaSources.source, 'weebdex' as any));

  console.log(`Importing chapters for ${sources.length} manga...\n`);

  let totalChapters = 0;
  let mangaWithChapters = 0;

  for (let i = 0; i < sources.length; i++) {
    const { mangaId, externalId, title } = sources[i];
    try {
      const count = await importChaptersForManga(mangaId, title, externalId);
      totalChapters += count;
      if (count > 0) mangaWithChapters++;
      console.log(`  [${i + 1}/${sources.length}] ${title} → ${count} chapters`);
    } catch (err) {
      console.log(`  [${i + 1}/${sources.length}] ${title} → FAIL: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone: ${totalChapters} chapters imported for ${mangaWithChapters}/${sources.length} manga`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => client.end());
