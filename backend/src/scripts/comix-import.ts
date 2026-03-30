#!/usr/bin/env npx tsx --tsconfig tsconfig.json
/**
 * Bulk import manga + chapters + images from Comix.to → ComicHub DB.
 * Note: API search/scope params appear non-functional. Uses order[chapter_updated_at]=desc by default.
 *
 * Usage:
 *   pnpm run import:comix                                  # default: pages 1-3, lang=all, recently updated
 *   pnpm run import:comix -- --from 1 --to 10              # pages 1-10
 *   pnpm run import:comix -- --lang vi                     # Vietnamese chapters only
 *   pnpm run import:comix -- --type manhwa --from 1 --to 5 # manhwa only
 *   pnpm run import:comix -- --dry                         # preview without importing
 */
import {
  db, schema, sqlClient, flag, hasFlag, apiFetch, upsertManga,
  resolveByName, eq, and, desc, count,
} from './import-utils.js';

// ─── CLI args ────────────────────────────────────────────────────
const PAGE_FROM = parseInt(flag('from', '1'), 10);
const PAGE_TO = parseInt(flag('to', '3'), 10);
const LIMIT = parseInt(flag('limit', '100'), 10);
const LANG = flag('lang', 'all');
const SEARCH = flag('search', '');
const TYPE = flag('type', '');
const DRY_RUN = hasFlag('dry');

const BASE = 'https://comix.to/api/v2';
const SOURCE = 'comix';
const LINK_MAP: Record<string, string> = { al: 'anilist', mal: 'mal', mu: 'mu' };

// Comix.to term_id → genre/theme name mapping (extracted from /genres page)
const GENRE_IDS: Record<number, string> = {
  6: 'Action', 7: 'Adventure', 8: 'Boys Love', 9: 'Comedy', 10: 'Crime',
  11: 'Drama', 12: 'Fantasy', 13: 'Girls Love', 14: 'Historical', 15: 'Horror',
  16: 'Isekai', 17: 'Magical Girls', 18: 'Mecha', 19: 'Medical', 20: 'Mystery',
  21: 'Philosophical', 22: 'Psychological', 23: 'Romance', 24: 'Sci-Fi',
  25: 'Slice of Life', 26: 'Sports', 27: 'Superhero', 28: 'Thriller',
  29: 'Tragedy', 30: 'Wuxia',
};
const THEME_IDS: Record<number, string> = {
  31: 'Aliens', 32: 'Animals', 33: 'Cooking', 34: 'Crossdressing',
  35: 'Delinquents', 36: 'Demons', 37: 'Genderswap', 38: 'Ghosts',
  39: 'Gyaru', 40: 'Harem', 41: 'Incest', 42: 'Loli', 43: 'Mafia',
  44: 'Magic', 45: 'Martial Arts', 46: 'Military', 47: 'Monster Girls',
  48: 'Monsters', 49: 'Music', 50: 'Ninja', 51: 'Office Workers',
  52: 'Police', 53: 'Post-Apocalyptic', 54: 'Reincarnation',
  55: 'Reverse Harem', 56: 'Samurai', 57: 'School Life', 58: 'Shota',
  59: 'Supernatural', 60: 'Survival', 61: 'Time Travel',
  62: 'Traditional Games', 63: 'Vampires', 64: 'Video Games',
  65: 'Villainess', 66: 'Virtual Reality', 67: 'Zombies',
  87264: 'Adult', 87265: 'Ecchi', 87266: 'Hentai', 87267: 'Mature', 87268: 'Smut',
};

function resolveTermIds(termIds: number[]): { genres: string[]; themes: string[] } {
  const genres: string[] = [];
  const themes: string[] = [];
  for (const id of termIds) {
    if (GENRE_IDS[id]) genres.push(GENRE_IDS[id]);
    else if (THEME_IDS[id]) themes.push(THEME_IDS[id]);
  }
  return { genres, themes };
}

function api<T>(path: string) {
  return apiFetch<T>(BASE, path);
}

function normalizeStatus(status?: string): string {
  if (status === 'releasing') return 'ongoing';
  if (status === 'finished') return 'completed';
  return 'ongoing';
}

function normalizeType(type?: string): string {
  if (type === 'manhwa') return 'manhwa';
  if (type === 'manhua') return 'manhua';
  if (type === 'doujinshi') return 'doujinshi';
  return 'manga'; // 'other' → 'manga'
}

function unixToDate(ts?: number): Date | null {
  return ts ? new Date(ts * 1000) : null;
}

// Extract external ID from URL:
//   anilist.co/manga/137358/  → "137358"
//   myanimelist.net/manga/144158/ → "144158"
//   mangaupdates.com/series/fcs6t5c/ → "fcs6t5c"
function extractIdFromUrl(key: string, url: string): string | null {
  if (!url) return null;
  const segments = url.replace(/\/+$/, '').split('/');
  const last = segments[segments.length - 1];
  if (key === 'al' || key === 'mal') {
    // Numeric ID from path: /manga/12345
    const match = url.match(/\/manga\/(\d+)/);
    return match ? match[1] : last || null;
  }
  if (key === 'mu') {
    // Slug from path: /series/fcs6t5c
    const match = url.match(/\/series\/([^/]+)/);
    return match ? match[1] : last || null;
  }
  return last || null;
}

// ─── Import single manga ────────────────────────────────────────
async function importOneManga(raw: any): Promise<{ mangaId: number; isNew: boolean }> {
  const hashId = raw.hash_id;
  const altTitles = raw.alt_titles ?? [];
  const nativeTitle = altTitles[0] ?? null;
  const coverUrl = raw.poster?.large ?? raw.poster?.medium ?? null;

  // External links — extract IDs from URLs
  const links: { type: string; externalId?: string; url?: string }[] = [];
  if (raw.links) {
    for (const [key, url] of Object.entries(raw.links as Record<string, string>)) {
      const type = LINK_MAP[key];
      if (!type || !url) continue;
      const id = extractIdFromUrl(key, url);
      if (id) links.push({ type, externalId: id, url });
    }
  }

  const { mangaId, isNew } = await upsertManga({
    title: raw.title,
    nativeTitle,
    altTitles,
    description: raw.synopsis ?? null,
    coverUrl,
    originalLanguage: raw.original_language ?? null,
    status: normalizeStatus(raw.status),
    type: normalizeType(raw.type),
    contentRating: raw.is_nsfw ? 'suggestive' : 'safe',
    demographic: null,
    year: raw.year ?? null,
    genreNames: resolveTermIds(raw.term_ids ?? []).genres,
    themeNames: resolveTermIds(raw.term_ids ?? []).themes,
    authorNames: [],
    artistNames: [],
    links,
    source: SOURCE,
    externalId: hashId,
  });

  return { mangaId, isNew };
}

// ─── Import chapters for a manga ────────────────────────────────
async function importChapters(mangaId: number, hashId: string): Promise<{ chapters: number; images: number }> {
  let page = 1;
  let totalChapters = 0;
  let totalImages = 0;
  let hasMore = true;

  while (hasMore) {
    const data = await api<any>(`/manga/${hashId}/chapters?limit=100&page=${page}`);
    const items = data.result?.items ?? [];

    const filtered = LANG === 'all'
      ? items
      : items.filter((ch: any) => ch.language === LANG);

    for (const raw of filtered) {
      const extId = String(raw.chapter_id);

      // Skip if this exact external chapter was already imported
      const [existingSrc] = await db.select({ chapterId: schema.chapterSources.chapterId })
        .from(schema.chapterSources).where(eq(schema.chapterSources.externalId, extId)).limit(1);
      if (existingSrc) continue;

      const num = parseFloat(raw.number ?? '0');
      const group = raw.scanlation_group;

      // Try insert chapter — may conflict if same number+lang already exists from another group
      const [inserted] = await db.insert(schema.chapters).values({
        mangaId,
        number: String(num),
        title: raw.name ?? null,
        slug: `chapter-${num}`,
        language: raw.language ?? 'en',
        volume: raw.volume && raw.volume > 0 ? String(raw.volume) : null,
        publishedAt: unixToDate(raw.created_at),
        order: Math.round(num * 10),
      }).onConflictDoNothing().returning({ id: schema.chapters.id });

      // Get chapter ID — either newly inserted or existing
      let chapterId: number;
      if (inserted) {
        chapterId = inserted.id;
        totalChapters++;
      } else {
        const [found] = await db.select({ id: schema.chapters.id }).from(schema.chapters)
          .where(and(eq(schema.chapters.mangaId, mangaId), eq(schema.chapters.number, String(num)), eq(schema.chapters.language, raw.language ?? 'en')))
          .limit(1);
        if (!found) continue;
        chapterId = found.id;
      }

      // Source mapping
      await db.insert(schema.chapterSources).values({
        chapterId, source: SOURCE, externalId: extId, lastSyncedAt: new Date(),
      }).onConflictDoNothing();

      // Resolve scanlation group
      let groupId: number | null = null;
      if (group?.name) {
        const groupIds = await resolveByName(schema.groups, [group.name]);
        if (groupIds.length) {
          groupId = groupIds[0];
          await db.insert(schema.chapterGroups)
            .values(groupIds.map((gid) => ({ chapterId, groupId: gid })))
            .onConflictDoNothing();
        }
      }

      // Fetch chapter images with groupId — allows multiple image sets per chapter
      try {
        const chDetail = await api<any>(`/chapters/${raw.chapter_id}`);
        const images = chDetail.result?.images ?? [];
        if (images.length) {
          await db.insert(schema.chapterImages).values(
            images.map((img: any, idx: number) => ({
              chapterId,
              groupId,
              imageUrl: img.url,
              sourceUrl: img.url,
              pageNumber: idx + 1,
              order: idx + 1,
              width: img.width ?? null,
              height: img.height ?? null,
            })),
          ).onConflictDoNothing();
          totalImages += images.length;
        }
      } catch (err: any) {
        console.error(`    Image error ch${num}: ${err.message}`);
      }
    }

    const pagination = data.result?.pagination;
    hasMore = pagination ? pagination.current_page < pagination.last_page : false;
    page++;
  }

  // Update manga counters
  if (totalChapters > 0) {
    const [latest] = await db.select({ id: schema.chapters.id })
      .from(schema.chapters).where(eq(schema.chapters.mangaId, mangaId))
      .orderBy(desc(schema.chapters.order)).limit(1);
    const [{ total }] = await db.select({ total: count() })
      .from(schema.chapters).where(eq(schema.chapters.mangaId, mangaId));
    await db.update(schema.manga).set({
      lastChapterId: latest?.id ?? null, chaptersCount: total, chapterUpdatedAt: new Date(),
    }).where(eq(schema.manga.id, mangaId));
  }

  return { chapters: totalChapters, images: totalImages };
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const langLabel = LANG === 'all' ? 'all languages' : LANG;
  const filters = [
    `pages ${PAGE_FROM}-${PAGE_TO}`,
    `lang=${langLabel}`,
    SEARCH && `search="${SEARCH}"`,
    TYPE && `type=${TYPE}`,
    DRY_RUN && 'DRY RUN',
  ].filter(Boolean).join(', ');
  console.log(`\nComix.to Import — ${filters}\n`);

  // Build query params — order by recently updated by default
  const params = new URLSearchParams();
  params.set('limit', String(LIMIT));
  params.set('order[chapter_updated_at]', 'desc');
  if (SEARCH) params.set('search', SEARCH);
  if (TYPE) params.set('type', TYPE);

  // Collect manga from pages
  const mangaList: any[] = [];
  const seenIds = new Set<string>();

  for (let page = PAGE_FROM; page <= PAGE_TO; page++) {
    params.set('page', String(page));
    const data = await api<any>(`/manga?${params.toString()}`);
    const items = data.result?.items ?? [];
    if (!items.length) { console.log(`  Page ${page}: empty, stopping.`); break; }

    for (const m of items) {
      if (!seenIds.has(m.hash_id)) {
        seenIds.add(m.hash_id);
        mangaList.push(m);
      }
    }

    const pagination = data.result?.pagination;
    const totalPages = pagination?.last_page ?? '?';
    console.log(`  Page ${page}/${totalPages}: +${items.length}, ${mangaList.length} unique total`);

    if (pagination && page >= pagination.last_page) break;
  }

  console.log(`\nFound ${mangaList.length} manga to import\n`);

  if (DRY_RUN) {
    mangaList.forEach((m, i) => console.log(`  ${i + 1}. [${m.hash_id}] ${m.title} (${m.type}, ${m.status})`));
    console.log('\n(dry run)');
    await sqlClient.end();
    return;
  }

  let imported = 0, skipped = 0, failed = 0, totalCh = 0, totalImg = 0;

  for (let i = 0; i < mangaList.length; i++) {
    const raw = mangaList[i];
    const tag = `[${i + 1}/${mangaList.length}]`;

    try {
      const { mangaId, isNew } = await importOneManga(raw);
      if (!isNew) { skipped++; continue; }

      if (!raw.has_chapters) {
        imported++;
        console.log(`${tag} ${raw.title} → id:${mangaId} (no chapters)`);
        continue;
      }

      const r = await importChapters(mangaId, raw.hash_id);
      imported++;
      totalCh += r.chapters;
      totalImg += r.images;
      console.log(`${tag} ${raw.title} → id:${mangaId}, +${r.chapters} ch, +${r.images} img`);
    } catch (err: any) {
      failed++;
      console.error(`${tag} FAIL ${raw.title}: ${err.message}`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Imported: ${imported} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(`Chapters: ${totalCh} | Images: ${totalImg}`);
  console.log(`${'═'.repeat(50)}\n`);
  await sqlClient.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
