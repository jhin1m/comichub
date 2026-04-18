#!/usr/bin/env npx tsx --tsconfig tsconfig.json
/**
 * Bulk import manga metadata from MangaBaka → ComicHub DB.
 * MangaBaka provides rich metadata only (no chapters/images).
 *
 * Usage:
 *   pnpm run import:mangabaka -- --query "one piece"         # search specific manga
 *   pnpm run import:mangabaka -- --query manga --from 1 --to 5  # broad search, pages 1-5
 *   pnpm run import:mangabaka -- --query manhwa --to 10      # 10 pages of manhwa
 *   pnpm run import:mangabaka -- --query manga --dry         # preview without importing
 */
import {
  sqlClient,
  flag,
  hasFlag,
  apiFetch,
  upsertManga,
} from './import-utils.js';
import { normalizeContentRating } from '../common/utils/content-rating.util.js';

// ─── CLI args ────────────────────────────────────────────────────
const QUERY = flag('query', 'manga');
const PAGE_FROM = parseInt(flag('from', '1'), 10);
const PAGE_TO = parseInt(flag('to', '3'), 10);
const LIMIT = parseInt(flag('limit', '50'), 10);
const DRY_RUN = hasFlag('dry');

const BASE = process.env.MANGABAKA_BASE_URL || 'https://api.mangabaka.dev';
const API_KEY = process.env.MANGABAKA_API_KEY || '';
const HEADERS: Record<string, string> = {
  Accept: 'application/json',
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
};

// ─── Source link type mapping ────────────────────────────────────
const SOURCE_TYPE_MAP: Record<string, string> = {
  my_anime_list: 'mal',
  anilist: 'anilist',
  kitsu: 'kitsu',
  manga_updates: 'mu',
  anime_planet: 'anime-planet',
  shikimori: 'shikimori',
  anime_news_network: 'ann',
};

function parseLinkType(url: string): string | null {
  if (url.includes('myanimelist.net')) return 'mal';
  if (url.includes('anilist.co')) return 'anilist';
  if (url.includes('kitsu.app') || url.includes('kitsu.io')) return 'kitsu';
  if (url.includes('mangaupdates.com')) return 'mu';
  if (url.includes('amazon')) return 'amazon';
  return null;
}

function normalizeStatus(status?: string): string {
  switch (status) {
    case 'releasing':
      return 'ongoing';
    case 'finished':
      return 'completed';
    case 'hiatus':
      return 'hiatus';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'ongoing';
  }
}

function normalizeType(type?: string): string {
  if (type === 'manhwa') return 'manhwa';
  if (type === 'manhua') return 'manhua';
  if (type === 'doujinshi') return 'doujinshi';
  return 'manga';
}

function api<T>(path: string) {
  return apiFetch<T>(BASE, path, { headers: HEADERS });
}

// ─── Normalize MangaBaka series → upsert data ───────────────────
function normalizeSeries(raw: any) {
  // Merge all titles (including native/romanized) into altTitles
  const titles: any[] = raw.titles ?? [];
  const altTitles = titles.map((t: any) => t.title).filter(Boolean);
  // Append native_title and romanized_title if not already present
  for (const extra of [raw.native_title, raw.romanized_title]) {
    if (extra && !altTitles.includes(extra)) altTitles.push(extra);
  }

  // Cover: prefer x300, fallback to raw
  const coverUrl = raw.cover?.x300?.x1 ?? raw.cover?.raw?.url ?? null;

  // Genres + themes from v2 (check length) or fallback to v1
  const genreNames = raw.genres_v2?.length
    ? raw.genres_v2
        .filter((g: any) => g.group === 'genre')
        .map((g: any) => g.name)
    : (raw.genres ?? []).map((g: string) => g.replace(/_/g, ' '));
  const themeNames = raw.tags_v2?.length
    ? raw.tags_v2
        .filter((t: any) => t.is_genre === false)
        .map((t: any) => t.name)
    : (raw.tags ?? []);

  // Links from source map + links array (links can be strings or {url} objects)
  const links: { type: string; externalId?: string; url?: string }[] = [];
  if (raw.source) {
    for (const [key, data] of Object.entries(
      raw.source as Record<string, any>,
    )) {
      const type = SOURCE_TYPE_MAP[key];
      if (type && data?.id != null)
        links.push({ type, externalId: String(data.id) });
    }
  }
  if (raw.links) {
    for (const entry of raw.links) {
      const url = typeof entry === 'string' ? entry : entry.url;
      if (!url) continue;
      const type = parseLinkType(url);
      if (type) links.push({ type, url });
    }
  }

  return {
    title: raw.title,
    altTitles,
    description: raw.description ?? null,
    coverUrl,
    originalLanguage: null as string | null,
    status: normalizeStatus(raw.status),
    type: normalizeType(raw.type),
    contentRating: normalizeContentRating(raw.content_rating),
    demographic: null as string | null,
    year: raw.year ?? null,
    genreNames,
    themeNames,
    authorNames: raw.authors ?? [],
    artistNames: raw.artists ?? [],
    links,
    source: 'mangabaka' as const,
    externalId: String(raw.id),
  };
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\nMangaBaka Import — query="${QUERY}", pages ${PAGE_FROM}-${PAGE_TO}, limit=${LIMIT}${DRY_RUN ? ' [DRY RUN]' : ''}\n`,
  );

  // Collect manga from search pages
  const mangaList: any[] = [];
  const seenIds = new Set<number>();

  for (let page = PAGE_FROM; page <= PAGE_TO; page++) {
    const data = await api<any>(
      `/v1/series/search?q=${encodeURIComponent(QUERY)}&page=${page}&limit=${LIMIT}`,
    );
    const results = data.data ?? data.results ?? [];
    if (!results.length) {
      console.log(`  Page ${page}: empty, stopping.`);
      break;
    }

    for (const m of results) {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id);
        mangaList.push(m);
      }
    }

    const totalPages = Math.ceil((data.pagination?.count ?? 0) / LIMIT);
    console.log(
      `  Page ${page}/${totalPages}: +${results.length} results, ${mangaList.length} unique total`,
    );

    if (!data.pagination?.next) {
      console.log('  No more pages.');
      break;
    }
  }

  console.log(`\nFound ${mangaList.length} manga to import\n`);

  if (DRY_RUN) {
    mangaList.forEach((m, i) =>
      console.log(
        `  ${i + 1}. [${m.id}] ${m.title} (${m.type ?? 'manga'}, ${m.status ?? '?'})`,
      ),
    );
    console.log('\n(dry run)');
    await sqlClient.end();
    return;
  }

  let imported = 0,
    skipped = 0,
    failed = 0;

  for (let i = 0; i < mangaList.length; i++) {
    const raw = mangaList[i];
    const tag = `[${i + 1}/${mangaList.length}]`;

    try {
      // Search results already contain full metadata — no need for /full endpoint
      const data = normalizeSeries(raw);
      const { mangaId, isNew } = await upsertManga(data);

      if (isNew) {
        imported++;
        console.log(`${tag} ${raw.title} → id:${mangaId}`);
      } else {
        skipped++;
      }
    } catch (err: any) {
      failed++;
      console.error(`${tag} FAIL ${raw.title}: ${err.message}`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(
    `Imported: ${imported} | Skipped: ${skipped} | Failed: ${failed}`,
  );
  console.log(`${'═'.repeat(50)}\n`);
  await sqlClient.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
