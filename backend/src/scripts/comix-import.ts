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
 *   pnpm run import:comix -- --resume                       # skip manga with no new chapters
 *   pnpm run import:comix -- --dry                         # preview without importing
 */
import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import {
  db,
  schema,
  sqlClient,
  flag,
  hasFlag,
  apiFetch,
  upsertManga,
  resolveByName,
  sleep,
  withRetry,
  withSourceLock,
  eq,
  and,
  desc,
  count,
} from './import-utils.js';
import { nsfwToContentRating } from '../common/utils/content-rating.util.js';
import { signUrl, signedFetch } from './comix-sign.js';

// ─── CLI args ────────────────────────────────────────────────────
const PAGE_FROM = parseInt(flag('from', '1'), 10);
const PAGE_TO = parseInt(flag('to', '3'), 10);
const LIMIT = parseInt(flag('limit', '100'), 10);
const LANG = flag('lang', 'all');
const SEARCH = flag('search', '');
const TYPE = flag('type', '');
const RESUME = hasFlag('resume');
const DRY_RUN = hasFlag('dry');

// Random jitter (default 400-1200ms) — override via --jitter-min / --jitter-max
const JITTER_MIN = parseInt(flag('jitter-min', '400'), 10);
const JITTER_MAX = parseInt(flag('jitter-max', '1200'), 10);
const JITTER: [number, number] = [JITTER_MIN, JITTER_MAX];

// Checkpoint — persist page progress across restarts
const CHECKPOINT_FILE = flag('checkpoint-file', './comix-checkpoint.json');
const RESET_CHECKPOINT = hasFlag('reset-checkpoint');
const HEALTH_INTERVAL = parseInt(flag('health-interval', '0'), 10); // pages between re-checks (0 = only at start)

// Page-fetch retry — resist transient 502 without aborting run
const PAGE_RETRY_MAX = parseInt(flag('page-retry-max', '3'), 10);
const PAGE_RETRY_BACKOFF = flag('page-retry-backoff', '5,15,45')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isFinite(n) && n >= 0);

// Per-fetch hard timeout — prevents TCP hangs (Cloudflare challenge, dead proxy)
const FETCH_TIMEOUT_MS = parseInt(flag('fetch-timeout-ms', '30000'), 10);

// Per-call retry for chapter-list and chapter-images fetches.
// Resists transient 5xx (incl. Cloudflare 521-524) without aborting the run.
const CHAPTER_RETRY_MAX = parseInt(flag('chapter-retry-max', '3'), 10);
const IMAGE_RETRY_MAX = parseInt(flag('image-retry-max', '3'), 10);
function parseBackoff(spec: string): number[] {
  return spec
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
}
const CHAPTER_RETRY_BACKOFF = parseBackoff(
  flag('chapter-retry-backoff', '3,10,30'),
);
const IMAGE_RETRY_BACKOFF = parseBackoff(
  flag('image-retry-backoff', '3,10,30'),
);

const BASE = 'https://comix.to/api/v2';
const SOURCE = 'comix';
const LINK_MAP: Record<string, string> = {
  al: 'anilist',
  mal: 'mal',
  mu: 'mu',
};

// Comix.to term_id → demographic mapping (extracted from /browser filter)
const DEMOGRAPHIC_IDS: Record<number, string> = {
  1: 'shoujo',
  2: 'shounen',
  3: 'josei',
  4: 'seinen',
};

// NSFW theme term_ids → content rating escalation (highest severity wins)
const NSFW_RATING_MAP: Record<number, string> = {
  87266: 'pornographic', // Hentai
  87264: 'erotica', // Adult
  87267: 'erotica', // Mature
  87268: 'erotica', // Smut
  87265: 'suggestive', // Ecchi
};
const RATING_SEVERITY: Record<string, number> = {
  safe: 0,
  suggestive: 1,
  erotica: 2,
  pornographic: 3,
};

// Comix.to term_id → genre/theme name mapping (extracted from /genres page)
const GENRE_IDS: Record<number, string> = {
  6: 'Action',
  7: 'Adventure',
  8: 'Boys Love',
  9: 'Comedy',
  10: 'Crime',
  11: 'Drama',
  12: 'Fantasy',
  13: 'Girls Love',
  14: 'Historical',
  15: 'Horror',
  16: 'Isekai',
  17: 'Magical Girls',
  18: 'Mecha',
  19: 'Medical',
  20: 'Mystery',
  21: 'Philosophical',
  22: 'Psychological',
  23: 'Romance',
  24: 'Sci-Fi',
  25: 'Slice of Life',
  26: 'Sports',
  27: 'Superhero',
  28: 'Thriller',
  29: 'Tragedy',
  30: 'Wuxia',
};
const THEME_IDS: Record<number, string> = {
  31: 'Aliens',
  32: 'Animals',
  33: 'Cooking',
  34: 'Crossdressing',
  35: 'Delinquents',
  36: 'Demons',
  37: 'Genderswap',
  38: 'Ghosts',
  39: 'Gyaru',
  40: 'Harem',
  41: 'Incest',
  42: 'Loli',
  43: 'Mafia',
  44: 'Magic',
  45: 'Martial Arts',
  46: 'Military',
  47: 'Monster Girls',
  48: 'Monsters',
  49: 'Music',
  50: 'Ninja',
  51: 'Office Workers',
  52: 'Police',
  53: 'Post-Apocalyptic',
  54: 'Reincarnation',
  55: 'Reverse Harem',
  56: 'Samurai',
  57: 'School Life',
  58: 'Shota',
  59: 'Supernatural',
  60: 'Survival',
  61: 'Time Travel',
  62: 'Traditional Games',
  63: 'Vampires',
  64: 'Video Games',
  65: 'Villainess',
  66: 'Virtual Reality',
  67: 'Zombies',
  87264: 'Adult',
  87265: 'Ecchi',
  87266: 'Hentai',
  87267: 'Mature',
  87268: 'Smut',
};

function resolveTermIds(termIds: number[]): {
  genres: string[];
  themes: string[];
  demographic: string | null;
  contentRating: string;
} {
  const genres: string[] = [];
  const themes: string[] = [];
  let demographic: string | null = null;
  let maxSeverity = 0;
  let contentRating = 'safe';

  for (const id of termIds) {
    if (DEMOGRAPHIC_IDS[id]) {
      demographic = DEMOGRAPHIC_IDS[id];
      continue;
    }
    if (GENRE_IDS[id]) genres.push(GENRE_IDS[id]);
    else if (THEME_IDS[id]) themes.push(THEME_IDS[id]);
    // Escalate content rating based on NSFW themes
    const rating = NSFW_RATING_MAP[id];
    if (rating && RATING_SEVERITY[rating] > maxSeverity) {
      maxSeverity = RATING_SEVERITY[rating];
      contentRating = rating;
    }
  }
  return { genres, themes, demographic, contentRating };
}

function api<T>(path: string) {
  return apiFetch<T>(BASE, path, {
    jitter: JITTER,
    fetchTimeoutMs: FETCH_TIMEOUT_MS,
  });
}

async function fetchPageWithRetry(path: string): Promise<any> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= PAGE_RETRY_MAX; attempt++) {
    try {
      return await api<any>(path);
    } catch (err: any) {
      lastErr = err;
      if (attempt < PAGE_RETRY_MAX) {
        const delaySec =
          PAGE_RETRY_BACKOFF[attempt] ??
          PAGE_RETRY_BACKOFF[PAGE_RETRY_BACKOFF.length - 1] ??
          5;
        console.warn(
          `  Page fetch attempt ${attempt + 1}/${PAGE_RETRY_MAX + 1} FAIL: ${err.message}. Retry in ${delaySec}s...`,
        );
        await sleep(delaySec * 1000);
      }
    }
  }
  throw lastErr!;
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
async function importOneManga(
  raw: any,
): Promise<{ mangaId: number; isNew: boolean }> {
  const hashId = raw.hash_id;
  const altTitles = raw.alt_titles ?? [];
  const coverUrl = raw.poster?.large ?? raw.poster?.medium ?? null;

  // External links — extract IDs from URLs
  const links: { type: string; externalId?: string; url?: string }[] = [];
  if (raw.links) {
    for (const [key, url] of Object.entries(
      raw.links as Record<string, string>,
    )) {
      const type = LINK_MAP[key];
      if (!type || !url) continue;
      const id = extractIdFromUrl(key, url);
      if (id) links.push({ type, externalId: id, url });
    }
  }

  const resolved = resolveTermIds(raw.term_ids ?? []);

  // Use theme-based rating if higher severity than is_nsfw flag
  const flagRating = nsfwToContentRating(!!raw.is_nsfw);
  const finalRating =
    (RATING_SEVERITY[resolved.contentRating] ?? 0) >=
    (RATING_SEVERITY[flagRating] ?? 0)
      ? resolved.contentRating
      : flagRating;

  const { mangaId, isNew } = await upsertManga({
    title: raw.title,
    altTitles,
    description: raw.synopsis ?? null,
    coverUrl,
    originalLanguage: raw.original_language ?? null,
    status: normalizeStatus(raw.status),
    type: normalizeType(raw.type),
    contentRating: finalRating,
    demographic: resolved.demographic,
    year: raw.year ?? null,
    genreNames: resolved.genres,
    themeNames: resolved.themes,
    authorNames: [],
    artistNames: [],
    links,
    source: SOURCE,
    externalId: hashId,
  });

  return { mangaId, isNew };
}

// ─── Import chapters for a manga ────────────────────────────────
async function importChapters(
  mangaId: number,
  hashId: string,
): Promise<{ chapters: number; images: number }> {
  let page = 1;
  let totalChapters = 0;
  let totalImages = 0;
  let hasMore = true;

  while (hasMore) {
    // Chapters endpoint requires signed URL (Comix.to anti-bot protection)
    // Retry wraps the WHOLE signedFetch — signing runs fresh each attempt,
    // so re-sign on retry is automatic (signUrl is called inside signedFetch).
    const data = await withRetry(
      () =>
        signedFetch<any>(
          `/manga/${hashId}/chapters`,
          { limit: 100, page },
          { jitter: JITTER, fetchTimeoutMs: FETCH_TIMEOUT_MS },
        ),
      {
        max: CHAPTER_RETRY_MAX,
        backoffSec: CHAPTER_RETRY_BACKOFF,
        label: `chapter-list ${hashId} p${page}`,
      },
    );
    const items = data.result?.items ?? [];

    const filtered =
      LANG === 'all' ? items : items.filter((ch: any) => ch.language === LANG);

    for (const raw of filtered) {
      const extId = String(raw.chapter_id);

      // Skip if this exact external chapter was already imported
      const [existingSrc] = await db
        .select({ chapterId: schema.chapterSources.chapterId })
        .from(schema.chapterSources)
        .where(eq(schema.chapterSources.externalId, extId))
        .limit(1);
      if (existingSrc) continue;

      const num = parseFloat(raw.number ?? '0');
      const group = raw.scanlation_group;

      // Try insert chapter — may conflict if same number+lang already exists from another group
      const [inserted] = await db
        .insert(schema.chapters)
        .values({
          mangaId,
          number: String(num),
          title: raw.name ?? null,
          slug: `chapter-${num}`,
          language: raw.language ?? 'en',
          volume: raw.volume && raw.volume > 0 ? String(raw.volume) : null,
          publishedAt: unixToDate(raw.created_at),
          order: Math.round(num * 10),
        })
        .onConflictDoNothing()
        .returning({ id: schema.chapters.id });

      // Get chapter ID — either newly inserted or existing
      let chapterId: number;
      if (inserted) {
        chapterId = inserted.id;
        totalChapters++;
      } else {
        const [found] = await db
          .select({ id: schema.chapters.id })
          .from(schema.chapters)
          .where(
            and(
              eq(schema.chapters.mangaId, mangaId),
              eq(schema.chapters.number, String(num)),
              eq(schema.chapters.language, raw.language ?? 'en'),
            ),
          )
          .limit(1);
        if (!found) continue;
        chapterId = found.id;
      }

      // Resolve scanlation group
      let groupId: number | null = null;
      if (group?.name) {
        const groupIds = await resolveByName(schema.groups, [group.name]);
        if (groupIds.length) {
          groupId = groupIds[0];
          await db
            .insert(schema.chapterGroups)
            .values(groupIds.map((gid) => ({ chapterId, groupId: gid })))
            .onConflictDoNothing();
        }
      }

      // Fetch chapter images with groupId — allows multiple image sets per chapter.
      // chapter_sources insert is DEFERRED until after images land so a mid-step
      // failure leaves the chapter unclaimed; re-runs will retry instead of
      // skipping (prevents "chapter ma": chapter_sources present but 0 images).
      let imagesInserted = false;
      try {
        const chDetail = await withRetry(
          () => api<any>(`/chapters/${raw.chapter_id}`),
          {
            max: IMAGE_RETRY_MAX,
            backoffSec: IMAGE_RETRY_BACKOFF,
            label: `chapter-images ${raw.chapter_id}`,
          },
        );
        const images = chDetail.result?.images ?? [];
        if (images.length) {
          await db
            .insert(schema.chapterImages)
            .values(
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
            )
            .onConflictDoNothing();
          totalImages += images.length;
          imagesInserted = true;
        }
      } catch (err: any) {
        console.error(`    Image error ch${num}: ${err.message}`);
      }

      // Only mark this external chapter as "imported" after images succeeded.
      if (imagesInserted) {
        await db
          .insert(schema.chapterSources)
          .values({
            chapterId,
            source: SOURCE,
            externalId: extId,
            lastSyncedAt: new Date(),
          })
          .onConflictDoNothing();
      }
    }

    const pagination = data.result?.pagination;
    hasMore = pagination
      ? pagination.current_page < pagination.last_page
      : false;
    page++;
  }

  // Always sync counters — conflicts may leave chaptersCount stale
  const [latest] = await db
    .select({ id: schema.chapters.id })
    .from(schema.chapters)
    .where(eq(schema.chapters.mangaId, mangaId))
    .orderBy(desc(schema.chapters.order))
    .limit(1);
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.chapters)
    .where(eq(schema.chapters.mangaId, mangaId));
  if (total > 0) {
    await db
      .update(schema.manga)
      .set({
        lastChapterId: latest?.id ?? null,
        chaptersCount: total,
        chapterUpdatedAt: new Date(),
      })
      .where(eq(schema.manga.id, mangaId));
  }

  return { chapters: totalChapters, images: totalImages };
}

// ─── Checkpoint ──────────────────────────────────────────────────
interface Checkpoint {
  startedAt: string;
  lastCompletedPage: number;
  stats: {
    imported: number;
    skipped: number;
    failed: number;
    chapters: number;
    images: number;
    failedPages: number[];
  };
}

function emptyCheckpoint(): Checkpoint {
  return {
    startedAt: new Date().toISOString(),
    lastCompletedPage: PAGE_FROM - 1,
    stats: {
      imported: 0,
      skipped: 0,
      failed: 0,
      chapters: 0,
      images: 0,
      failedPages: [],
    },
  };
}

function loadCheckpoint(): Checkpoint {
  if (RESET_CHECKPOINT) {
    try {
      unlinkSync(CHECKPOINT_FILE);
    } catch {
      /* no-op */
    }
    return emptyCheckpoint();
  }
  try {
    const parsed = JSON.parse(
      readFileSync(CHECKPOINT_FILE, 'utf-8'),
    ) as Checkpoint;
    if (typeof parsed?.lastCompletedPage === 'number' && parsed.stats) {
      // Backward-compat: pre-retry checkpoints lack failedPages
      if (!Array.isArray(parsed.stats.failedPages))
        parsed.stats.failedPages = [];
      return parsed;
    }
  } catch {
    /* corrupt or missing — start fresh */
  }
  return emptyCheckpoint();
}

function saveCheckpoint(cp: Checkpoint): void {
  const tmp = `${CHECKPOINT_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(cp, null, 2));
  renameSync(tmp, CHECKPOINT_FILE); // atomic
}

// ─── Pre-flight health check ─────────────────────────────────────
async function healthCheck(): Promise<boolean> {
  const MAX_RETRIES = 3;
  const BACKOFF = [2000, 4000, 8000];
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await signUrl('/manga/test/chapters'); // signing module OK
      const res = await fetch(`${BASE}/manga?limit=1&page=1`);
      if (res.ok) return true;
      console.warn(`  Health check attempt ${attempt + 1}: API ${res.status}`);
    } catch (err: any) {
      console.warn(`  Health check attempt ${attempt + 1}: ${err.message}`);
    }
    if (attempt < MAX_RETRIES - 1) await sleep(BACKOFF[attempt]);
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const langLabel = LANG === 'all' ? 'all languages' : LANG;
  const filters = [
    `pages ${PAGE_FROM}-${PAGE_TO}`,
    `lang=${langLabel}`,
    `jitter=${JITTER_MIN}-${JITTER_MAX}ms`,
    SEARCH && `search="${SEARCH}"`,
    TYPE && `type=${TYPE}`,
    RESUME && 'RESUME',
    DRY_RUN && 'DRY RUN',
    process.env.USE_PROXY === '1' && 'PROXY',
  ]
    .filter(Boolean)
    .join(', ');
  console.log(`\nComix.to Import — ${filters}\n`);

  // Pre-flight health check — validate signing + API before doing any work
  console.log('  Running pre-flight health check...');
  if (!(await healthCheck())) {
    console.error('  Health check FAILED after retries. Exiting with code 2.');
    await sqlClient.end();
    process.exit(2);
  }
  console.log('  Health OK.\n');

  // Load checkpoint (may be empty)
  const cp = loadCheckpoint();
  if (cp.lastCompletedPage >= PAGE_FROM) {
    console.log(
      `  Resuming from checkpoint: last completed page ${cp.lastCompletedPage}`,
    );
    console.log(`    stats so far: ${JSON.stringify(cp.stats)}\n`);
  }

  // Build query params — order by recently updated by default
  const params = new URLSearchParams();
  params.set('limit', String(LIMIT));
  params.set('order[chapter_updated_at]', 'desc');
  if (SEARCH) params.set('search', SEARCH);
  if (TYPE) params.set('type', TYPE);

  // Per-page processing with checkpoint after each page
  const startPage = Math.max(PAGE_FROM, cp.lastCompletedPage + 1);

  for (let page = startPage; page <= PAGE_TO; page++) {
    // Periodic re-health-check between pages
    if (
      HEALTH_INTERVAL > 0 &&
      page > startPage &&
      (page - startPage) % HEALTH_INTERVAL === 0
    ) {
      if (!(await healthCheck())) {
        console.error(
          `  Health check FAILED mid-run at page ${page}. Exiting with code 2.`,
        );
        await sqlClient.end();
        process.exit(2);
      }
    }

    params.set('page', String(page));
    let data: any;
    try {
      data = await fetchPageWithRetry(`/manga?${params.toString()}`);
    } catch (err: any) {
      console.error(
        `  Page ${page} fetch FAILED after ${PAGE_RETRY_MAX} retries: ${err.message}. Skipping page.`,
      );
      cp.stats.failedPages.push(page);
      cp.lastCompletedPage = page;
      if (!DRY_RUN) saveCheckpoint(cp);
      continue;
    }
    const items = data.result?.items ?? [];
    if (!items.length) {
      console.log(`  Page ${page}: empty, stopping.`);
      break;
    }
    const pagination = data.result?.pagination;
    const totalPages = pagination?.last_page ?? '?';
    console.log(`\n  Page ${page}/${totalPages}: ${items.length} items`);

    if (DRY_RUN) {
      items.forEach((m: any, i: number) =>
        console.log(
          `    ${i + 1}. [${m.hash_id}] ${m.title} (${m.type}, ${m.status})`,
        ),
      );
    } else {
      for (let i = 0; i < items.length; i++) {
        const raw = items[i];
        const tag = `    [p${page} ${i + 1}/${items.length}]`;

        try {
          // Advisory lock — prevents two shards from processing the same
          // manga when the source's list order shifts mid-run. Returns a
          // sentinel object when fn ran, or null if another shard owns it.
          const result = await withSourceLock<'done'>(
            SOURCE,
            raw.hash_id,
            async () => {
              const { mangaId, isNew } = await importOneManga(raw);

              if (!raw.has_chapters) {
                if (isNew) cp.stats.imported++;
                else cp.stats.skipped++;
                console.log(
                  `${tag} ${raw.title} → id:${mangaId} (no chapters)`,
                );
                return 'done';
              }

              // --resume: skip manga whose source hasn't updated since last import
              if (RESUME && !isNew) {
                const [local] = await db
                  .select({ chapterUpdatedAt: schema.manga.chapterUpdatedAt })
                  .from(schema.manga)
                  .where(eq(schema.manga.id, mangaId))
                  .limit(1);
                const sourceUpdated = unixToDate(raw.chapter_updated_at);
                if (
                  local?.chapterUpdatedAt &&
                  sourceUpdated &&
                  local.chapterUpdatedAt >= sourceUpdated
                ) {
                  cp.stats.skipped++;
                  console.log(
                    `${tag} ${raw.title} ⏭ id:${mangaId} (up-to-date)`,
                  );
                  return 'done';
                }
              }

              const r = await importChapters(mangaId, raw.hash_id);
              if (isNew) cp.stats.imported++;
              else cp.stats.skipped++;
              cp.stats.chapters += r.chapters;
              cp.stats.images += r.images;
              const label = isNew ? '→' : '↻';
              console.log(
                `${tag} ${raw.title} ${label} id:${mangaId}, +${r.chapters} ch, +${r.images} img`,
              );
              return 'done';
            },
          );

          if (result === null) {
            cp.stats.skipped++;
            console.log(
              `${tag} ${raw.title} ⏭ (locked by another shard)`,
            );
          }
        } catch (err: any) {
          cp.stats.failed++;
          console.error(`${tag} FAIL ${raw.title}: ${err.message}`);
        }
        // Per-manga heartbeat — bumps checkpoint mtime so health-check sees progress
        // even when a single page takes >30 min. lastCompletedPage only advances at page end.
        if (!DRY_RUN) saveCheckpoint(cp);
      }
    }

    // Checkpoint after each page (atomic) — advances lastCompletedPage for --resume
    cp.lastCompletedPage = page;
    if (!DRY_RUN) saveCheckpoint(cp);

    if (pagination && page >= pagination.last_page) {
      console.log(`  Reached last page (${pagination.last_page}).`);
      break;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(
    `Imported: ${cp.stats.imported} | Skipped: ${cp.stats.skipped} | Failed: ${cp.stats.failed}`,
  );
  console.log(`Chapters: ${cp.stats.chapters} | Images: ${cp.stats.images}`);
  console.log(`Last completed page: ${cp.lastCompletedPage}`);
  if (cp.stats.failedPages.length > 0) {
    console.log(
      `\n⚠️ Failed pages (${cp.stats.failedPages.length}): ${cp.stats.failedPages.join(', ')}`,
    );
    console.log(`  Re-run: --from <N> --to <N> per failed page to recover.`);
  }
  console.log(`${'═'.repeat(50)}\n`);
  await sqlClient.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
