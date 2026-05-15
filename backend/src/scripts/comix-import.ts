#!/usr/bin/env npx tsx --tsconfig tsconfig.json
/**
 * Bulk import manga + chapters + images from Comix.to → ComicHub DB.
 *
 * API surface (post 2026-05-07 Vite migration):
 *  - GET /api/v1/manga?...                  public, no signing
 *  - GET /api/v1/manga/{hid}                public detail (genres, altTitles, authors)
 *  - GET /api/v1/manga/{hid}/chapters?...   signed (`_=<sig>`)
 *  - GET /api/v1/chapters/{id}              signed (`_=<sig>`) — pages live here
 *
 * Hybrid metadata strategy: list endpoint lacks genres/altTitles/authors, so
 * we fetch /manga/{hid} detail ONLY for new manga. Existing manga skip the
 * detail call (genre/altTitles aren't refreshed once imported).
 *
 * Usage:
 *   pnpm run import:comix                                  # default: pages 1-3, lang=all, recently updated
 *   pnpm run import:comix -- --from 1 --to 10              # pages 1-10
 *   pnpm run import:comix -- --lang vi                     # Vietnamese chapters only
 *   pnpm run import:comix -- --type manhwa --from 1 --to 5 # manhwa only
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
  bumpMangaOnChapterRelease,
  invalidateMangaListCache,
  eq,
  and,
} from './import-utils.js';
import { signedFetch } from './comix-sign.js';

// ─── CLI args ────────────────────────────────────────────────────
const PAGE_FROM = parseInt(flag('from', '1'), 10);
const PAGE_TO = parseInt(flag('to', '3'), 10);
const LIMIT = parseInt(flag('limit', '100'), 10);
const LANG = flag('lang', 'all');
const SEARCH = flag('search', '');
const TYPE = flag('type', '');
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

const BASE = 'https://comix.to/api/v1';
const SOURCE = 'comix';
const LINK_MAP: Record<string, string> = {
  al: 'anilist',
  mal: 'mal',
  mu: 'mu',
};
const VALID_RATINGS = new Set([
  'safe',
  'suggestive',
  'erotica',
  'pornographic',
]);

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
function buildLinks(
  rawLinks: Record<string, string | null> | undefined,
): { type: string; externalId?: string; url?: string }[] {
  const out: { type: string; externalId?: string; url?: string }[] = [];
  if (!rawLinks) return out;
  for (const [key, url] of Object.entries(rawLinks)) {
    const type = LINK_MAP[key];
    if (!type || !url) continue;
    const id = extractIdFromUrl(key, url);
    if (id) out.push({ type, externalId: id, url });
  }
  return out;
}

function pickRating(raw: any): string {
  const r = (raw?.contentRating ?? '').toLowerCase();
  return VALID_RATINGS.has(r) ? r : 'safe';
}

/**
 * Hybrid metadata fetch: list endpoint lacks genres/altTitles/authors so we
 * call /manga/{hid} only for new manga (not yet in mangaSources). Existing
 * manga skip the detail call — saves ~100 HTTP/page on hourly cron runs.
 */
async function importOneManga(
  raw: any,
): Promise<{ mangaId: number; isNew: boolean }> {
  const hid = raw.hid;

  // Cheap existence check — avoid detail fetch for already-imported manga.
  const [existingSrc] = await db
    .select({ mangaId: schema.mangaSources.mangaId })
    .from(schema.mangaSources)
    .where(
      and(
        eq(
          schema.mangaSources.source,
          SOURCE as typeof schema.mangaSources.$inferInsert.source,
        ),
        eq(schema.mangaSources.externalId, hid),
      ),
    )
    .limit(1);

  if (existingSrc) {
    return { mangaId: existingSrc.mangaId, isNew: false };
  }

  // New manga — pull detail to enrich genres/themes/altTitles/authors.
  // /manga/{hid} is unsigned per bundle interceptor whitelist.
  const detail = await api<any>(`/manga/${hid}`);
  const d = detail.result ?? {};

  const altTitles: string[] = Array.isArray(d.altTitles) ? d.altTitles : [];
  const coverUrl = d.poster?.large ?? d.poster?.medium ?? null;
  const links = buildLinks(d.links);

  const genreNames: string[] = (d.genres ?? [])
    .map((g: any) => g?.title)
    .filter(Boolean);
  // Themes come from `tags` + `formats` (both are theme-like taxonomy).
  const themeNames: string[] = [...(d.tags ?? []), ...(d.formats ?? [])]
    .map((t: any) => t?.title)
    .filter(Boolean);
  const demographic: string | null = d.demographics?.[0]?.slug ?? null;
  const authorNames: string[] = (d.authors ?? [])
    .map((a: any) => a?.title)
    .filter(Boolean);
  const artistNames: string[] = (d.artists ?? [])
    .map((a: any) => a?.title)
    .filter(Boolean);

  const { mangaId, isNew } = await upsertManga({
    title: d.title ?? raw.title,
    altTitles,
    description: d.synopsis ?? raw.synopsis ?? null,
    coverUrl,
    originalLanguage: d.originalLanguage ?? raw.originalLanguage ?? null,
    status: normalizeStatus(d.status ?? raw.status),
    type: normalizeType(d.type ?? raw.type),
    contentRating: pickRating(d) || pickRating(raw),
    demographic,
    year: d.year ?? raw.year ?? null,
    genreNames,
    themeNames,
    authorNames,
    artistNames,
    links,
    source: SOURCE,
    externalId: hid,
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
      const extId = String(raw.id);

      // Skip if this exact external chapter was already imported.
      // Scope to (source, externalId): chapter_sources is uniquely keyed by
      // both — Comix int-cast ids could collide with other sources' ids.
      const [existingSrc] = await db
        .select({ chapterId: schema.chapterSources.chapterId })
        .from(schema.chapterSources)
        .where(
          and(
            eq(
              schema.chapterSources.source,
              SOURCE as typeof schema.chapterSources.$inferInsert.source,
            ),
            eq(schema.chapterSources.externalId, extId),
          ),
        )
        .limit(1);
      if (existingSrc) continue;

      const num = parseFloat(String(raw.number ?? '0'));
      const group = raw.group;

      // Try insert chapter — may conflict if same number+lang already exists from another group.
      // publishedAt set to now: new API only provides relative strings ("39s ago"),
      // so we use insert time as approximation (semantic: "this chapter just landed").
      const [inserted] = await db
        .insert(schema.chapters)
        .values({
          mangaId,
          number: String(num),
          title: raw.name ?? null,
          slug: `chapter-${num}`,
          language: raw.language ?? 'en',
          volume: raw.volume && raw.volume > 0 ? String(raw.volume) : null,
          publishedAt: new Date(),
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
      // /chapters/{id} now requires signing (post 2026-05-07 Vite migration).
      let imagesInserted = false;
      try {
        const chDetail = await withRetry(
          () =>
            signedFetch<any>(
              `/chapters/${raw.id}`,
              {},
              { jitter: JITTER, fetchTimeoutMs: FETCH_TIMEOUT_MS },
            ),
          {
            max: IMAGE_RETRY_MAX,
            backoffSec: IMAGE_RETRY_BACKOFF,
            label: `chapter-images ${raw.id}`,
          },
        );
        const images = chDetail.result?.pages ?? [];
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
  await bumpMangaOnChapterRelease(db, mangaId);

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
// End-to-end signing verification: pull a real hid from the unsigned list,
// then sign + fetch its chapters. Catches stale signers / rotated bundles
// that a synthetic 'test' hid wouldn't surface.
async function healthCheck(): Promise<boolean> {
  const MAX_RETRIES = 3;
  const BACKOFF = [2000, 4000, 8000];
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const listRes = await fetch(`${BASE}/manga?limit=1&page=1`);
      if (!listRes.ok) throw new Error(`list endpoint API ${listRes.status}`);
      const list: any = await listRes.json();
      const sample = list?.result?.items?.[0];
      if (!sample?.hid) throw new Error('list returned no items');

      // Real signed call — confirms signature is accepted by server.
      await signedFetch<any>(
        `/manga/${sample.hid}/chapters`,
        { limit: 1, page: 1 },
        { fetchTimeoutMs: 15_000 },
      );
      return true;
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
          `    ${i + 1}. [${m.hid}] ${m.title} (${m.type}, ${m.status})`,
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
            raw.hid,
            async () => {
              const { mangaId, isNew } = await importOneManga(raw);

              if (!raw.hasChapters) {
                if (isNew) cp.stats.imported++;
                else cp.stats.skipped++;
                console.log(
                  `${tag} ${raw.title} → id:${mangaId} (no chapters)`,
                );
                return 'done';
              }

              // Note: --resume time-skip dropped — new API only exposes relative
              // strings ("6s ago") so direct timestamp comparison isn't reliable.
              // chapter_sources externalId dedup still prevents re-importing.

              const r = await importChapters(mangaId, raw.hid);
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
            console.log(`${tag} ${raw.title} ⏭ (locked by another shard)`);
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
  if (cp.stats.chapters > 0) await invalidateMangaListCache();
  await sqlClient.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
