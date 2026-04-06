#!/usr/bin/env npx tsx --tsconfig tsconfig.json
/**
 * Bulk import manga + chapters + images from atsu.moe → ComicHub DB.
 *
 * Usage:
 *   pnpm run import:atsumaru -- --search "dandadan"         # search & import matching manga
 *   pnpm run import:atsumaru -- --id m7bps                  # import single manga by ID
 *   pnpm run import:atsumaru -- --from 0 --to 2             # browse trending pages 0-2
 *   pnpm run import:atsumaru -- --search "solo" --dry       # preview without importing
 *   pnpm run import:atsumaru -- --id m7bps --no-chapters    # metadata only, skip chapters
 */
import {
  db, schema, sqlClient, flag, hasFlag, upsertManga,
  resolveByName, eq, and, desc, count, sleep,
} from './import-utils.js';

// ─── CLI args ────────────────────────────────────────────────────
const SEARCH = flag('search', '');
const SINGLE_ID = flag('id', '');
const PAGE_FROM = parseInt(flag('from', '0'), 10);
const PAGE_TO = parseInt(flag('to', '2'), 10);
const DRY_RUN = hasFlag('dry');
const NO_CHAPTERS = hasFlag('no-chapters');

const BASE = 'https://atsu.moe';
const SOURCE = 'atsumaru';
const THROTTLE_MS = 500;

const HEADERS: Record<string, string> = {
  Accept: '*/*',
  Referer: BASE,
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

const STATUS_MAP: Record<string, string> = {
  ongoing: 'ongoing', completed: 'completed', hiatus: 'hiatus', canceled: 'cancelled',
};
const TYPE_MAP: Record<string, string> = {
  manga: 'manga', manwha: 'manhwa', manhwa: 'manhwa', manhua: 'manhua', oel: 'manga',
};
const NSFW_GENRES: Record<string, string> = {
  hentai: 'pornographic', adult: 'erotica', mature: 'erotica',
  smut: 'erotica', erotica: 'erotica', ecchi: 'suggestive',
};
const SEVERITY: Record<string, number> = {
  safe: 0, suggestive: 1, erotica: 2, pornographic: 3,
};

// ─── Throttled API ──────────────────────────────────────────────
let lastReq = 0;
async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const elapsed = Date.now() - lastReq;
  if (elapsed < THROTTLE_MS) await sleep(THROTTLE_MS - elapsed);
  lastReq = Date.now();
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...HEADERS, ...opts?.headers } });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ─── Image URL resolution ───────────────────────────────────────
function resolveImage(path?: unknown): string | null {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path.replace(/^http:/, 'https:');
  if (path.startsWith('//')) return `https:${path}`;
  return `${BASE}/static/${path.replace(/^\//, '')}`;
}

// ─── Infer content rating from tags ─────────────────────────────
function inferContentRating(tags: string[]): string {
  let rating = 'safe';
  for (const tag of tags) {
    const mapped = NSFW_GENRES[tag.toLowerCase()];
    if (mapped && SEVERITY[mapped] > SEVERITY[rating]) rating = mapped;
  }
  return rating;
}

// ─── Import single manga ────────────────────────────────────────
async function importOneManga(mangaId: string): Promise<{ mangaId: number; isNew: boolean; title: string }> {
  const data = await api<any>(`/api/manga/page?id=${encodeURIComponent(mangaId)}`);
  const raw = data.mangaPage;

  const tagNames = (raw.tags ?? []).map((t: any) => t.name);
  const authorNames = (raw.authors ?? []).map((a: any) => a.name);

  const result = await upsertManga({
    title: raw.title,
    altTitles: [],
    description: raw.synopsis ?? null,
    coverUrl: resolveImage(raw.poster ?? raw.image),
    originalLanguage: null,
    status: STATUS_MAP[(raw.status ?? '').toLowerCase()] ?? 'ongoing',
    type: TYPE_MAP[(raw.type ?? '').toLowerCase()] ?? 'manga',
    contentRating: inferContentRating(tagNames),
    demographic: null,
    year: null,
    genreNames: tagNames,
    themeNames: [],
    authorNames,
    artistNames: authorNames,
    links: [],
    source: SOURCE,
    externalId: mangaId,
  });

  return { ...result, title: raw.title };
}

// ─── Import chapters for a manga ────────────────────────────────
async function importChapters(
  internalId: number,
  externalId: string,
): Promise<{ chapters: number; images: number }> {
  const data = await api<any>(`/api/manga/allChapters?mangaId=${encodeURIComponent(externalId)}`);
  const chapters = data.chapters ?? [];

  let totalChapters = 0;
  let totalImages = 0;

  for (const raw of chapters) {
    const num = raw.number ?? 0;

    // Skip if this exact external chapter was already imported
    const compoundId = `${externalId}:::${raw.id}`;
    const [existingSrc] = await db.select({ chapterId: schema.chapterSources.chapterId })
      .from(schema.chapterSources)
      .where(and(
        eq(schema.chapterSources.source, SOURCE),
        eq(schema.chapterSources.externalId, compoundId),
      ))
      .limit(1);
    if (existingSrc) continue;

    // Try insert chapter
    const [inserted] = await db.insert(schema.chapters).values({
      mangaId: internalId,
      number: String(num),
      title: raw.title ?? null,
      slug: `chapter-${num}`,
      language: 'en',
      publishedAt: raw.createdAt ? new Date(raw.createdAt) : null,
      order: Math.round(num * 10),
    }).onConflictDoNothing().returning({ id: schema.chapters.id });

    let chapterId: number;
    if (inserted) {
      chapterId = inserted.id;
      totalChapters++;
    } else {
      const [found] = await db.select({ id: schema.chapters.id }).from(schema.chapters)
        .where(and(
          eq(schema.chapters.mangaId, internalId),
          eq(schema.chapters.number, String(num)),
          eq(schema.chapters.language, 'en'),
        )).limit(1);
      if (!found) continue;
      chapterId = found.id;
    }

    // Source mapping
    await db.insert(schema.chapterSources).values({
      chapterId, source: SOURCE, externalId: compoundId, lastSyncedAt: new Date(),
    }).onConflictDoNothing();

    // Fetch and insert images
    try {
      const imgData = await api<any>(
        `/api/read/chapter?mangaId=${encodeURIComponent(externalId)}&chapterId=${encodeURIComponent(raw.id)}`,
      );
      const pages = imgData.readChapter?.pages ?? [];
      if (pages.length) {
        await db.insert(schema.chapterImages).values(
          pages.map((p: any, idx: number) => ({
            chapterId,
            groupId: null,
            imageUrl: resolveImage(p.image) ?? '',
            sourceUrl: resolveImage(p.image) ?? '',
            pageNumber: idx + 1,
            order: idx + 1,
          })),
        ).onConflictDoNothing();
        totalImages += pages.length;
      }
    } catch (err: any) {
      console.error(`    Image error ch${num}: ${err.message}`);
    }
  }

  // Sync counters
  const [latest] = await db.select({ id: schema.chapters.id })
    .from(schema.chapters).where(eq(schema.chapters.mangaId, internalId))
    .orderBy(desc(schema.chapters.order)).limit(1);
  const [{ total }] = await db.select({ total: count() })
    .from(schema.chapters).where(eq(schema.chapters.mangaId, internalId));
  if (total > 0) {
    await db.update(schema.manga).set({
      lastChapterId: latest?.id ?? null,
      chaptersCount: total,
      chapterUpdatedAt: new Date(),
    }).where(eq(schema.manga.id, internalId));
  }

  return { chapters: totalChapters, images: totalImages };
}

// ─── Fetch manga list ───────────────────────────────────────────
async function fetchMangaList(): Promise<{ id: string; title: string }[]> {
  if (SINGLE_ID) return [{ id: SINGLE_ID, title: SINGLE_ID }];

  if (SEARCH) {
    const data = await api<any>('/api/explore/filteredView', {
      method: 'POST',
      body: JSON.stringify({
        page: 0,
        filter: { search: SEARCH, types: ['Manga', 'Manwha', 'Manhua', 'OEL'], showAdult: false },
      }),
    });
    const mangas = data.hits
      ? data.hits.map((h: any) => h.document)
      : data.items ?? [];
    return mangas.map((m: any) => ({ id: m.id, title: m.title }));
  }

  // Default: browse trending pages
  const list: { id: string; title: string }[] = [];
  for (let page = PAGE_FROM; page <= PAGE_TO; page++) {
    const data = await api<any>(`/api/infinite/trending?page=${page}&types=Manga,Manwha,Manhua,OEL`);
    const items = data.items ?? [];
    if (!items.length) { console.log(`  Page ${page}: empty, stopping.`); break; }
    for (const m of items) list.push({ id: m.id, title: m.title });
    console.log(`  Page ${page}: ${items.length} found, total ${list.length}`);
  }
  return list;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const mode = SINGLE_ID ? `id=${SINGLE_ID}` : SEARCH ? `search="${SEARCH}"` : `trending pages ${PAGE_FROM}-${PAGE_TO}`;
  console.log(`\nAtsumaru Import — ${mode}${DRY_RUN ? ' [DRY RUN]' : ''}${NO_CHAPTERS ? ' [NO CHAPTERS]' : ''}\n`);

  const mangaList = await fetchMangaList();
  console.log(`Found ${mangaList.length} manga to import\n`);

  if (DRY_RUN) {
    mangaList.forEach((m, i) => console.log(`  ${i + 1}. ${m.title} (${m.id})`));
    console.log('\n(dry run)');
    await sqlClient.end();
    return;
  }

  let imported = 0, skipped = 0, failed = 0, totalCh = 0, totalImg = 0;
  for (let i = 0; i < mangaList.length; i++) {
    const m = mangaList[i];
    const tag = `[${i + 1}/${mangaList.length}]`;
    try {
      const { mangaId, isNew, title } = await importOneManga(m.id);
      const label = isNew ? '→' : '↻';

      if (NO_CHAPTERS) {
        console.log(`${tag} ${title} ${label} id:${mangaId}`);
      } else {
        const r = await importChapters(mangaId, m.id);
        totalCh += r.chapters;
        totalImg += r.images;
        console.log(`${tag} ${title} ${label} id:${mangaId}, +${r.chapters} ch, +${r.images} img`);
      }

      if (isNew) imported++; else skipped++;
    } catch (err: any) {
      failed++;
      console.error(`${tag} FAIL ${m.title}: ${err.message}`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Imported: ${imported} | Skipped: ${skipped} | Failed: ${failed}`);
  if (!NO_CHAPTERS) console.log(`Chapters: ${totalCh} | Images: ${totalImg}`);
  console.log(`${'═'.repeat(50)}\n`);
  await sqlClient.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
