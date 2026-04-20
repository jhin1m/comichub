/**
 * Shared utilities for import scripts (DB, taxonomy resolvers, throttle).
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '@/database/schema/index.js';
import { slugify } from '@/common/utils/slug.util.js';

export { schema, eq, and, inArray };
export { desc, count } from 'drizzle-orm';

// ─── DB ──────────────────────────────────────────────────────────
export const sqlClient = postgres(process.env.DATABASE_URL!);
export const db = drizzle(sqlClient, { schema });

// ─── CLI helpers ─────────────────────────────────────────────────
const argv = process.argv.slice(2);
export function flag(name: string, fallback: string): string {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}
export const hasFlag = (name: string) => argv.includes(`--${name}`);

// ─── Throttled fetch ─────────────────────────────────────────────
let lastReq = 0;
export type ThrottleOpts = {
  throttleMs?: number;
  jitter?: [number, number];
  headers?: Record<string, string>;
  fetchTimeoutMs?: number;
};

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

function resolveThrottleMs(opts?: ThrottleOpts): number {
  if (opts?.jitter) {
    const [min, max] = opts.jitter;
    return Math.floor(Math.random() * (max - min) + min);
  }
  return opts?.throttleMs ?? 250;
}

async function resolveFetchFn(): Promise<typeof fetch> {
  if (process.env.USE_PROXY === '1')
    return (await import('./proxy-fetch.js')).proxyFetch;
  return fetch;
}

export async function throttledFetch(
  url: string,
  opts?: ThrottleOpts,
): Promise<Response> {
  const ms = resolveThrottleMs(opts);
  const elapsed = Date.now() - lastReq;
  if (elapsed < ms) await sleep(ms - elapsed);
  lastReq = Date.now();
  const fetchFn = await resolveFetchFn();
  const signal = AbortSignal.timeout(
    opts?.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  );
  return fetchFn(url, { headers: opts?.headers, signal });
}

export async function apiFetch<T>(
  base: string,
  path: string,
  opts?: ThrottleOpts,
): Promise<T> {
  const res = await throttledFetch(`${base}${path}`, opts);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Retry helper ────────────────────────────────────────────────
// Classify errors as retryable (transient) vs fatal. Transient: 5xx incl.
// Cloudflare 521-524, 408, 429, plus common network errors / aborts.
export function isRetryable(err: Error): boolean {
  const msg = err?.message || '';
  const m = msg.match(/^API (\d{3}):/);
  if (m) {
    const s = parseInt(m[1], 10);
    return s >= 500 || s === 408 || s === 429;
  }
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|aborted|timeout|socket hang up/i.test(
    msg,
  );
}

export interface RetryOpts {
  max: number;
  backoffSec: number[];
  label: string;
  onAttempt?: (attempt: number, err: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts,
): Promise<T> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= opts.max; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      if (attempt >= opts.max) break;
      const delaySec =
        opts.backoffSec[attempt] ??
        opts.backoffSec[opts.backoffSec.length - 1] ??
        5;
      opts.onAttempt?.(attempt + 1, err);
      console.warn(
        `  ${opts.label} attempt ${attempt + 1}/${opts.max + 1} FAIL: ${err.message}. Retry in ${delaySec}s...`,
      );
      await sleep(delaySec * 1000);
    }
  }
  throw lastErr!;
}

// ─── Shard dedupe ────────────────────────────────────────────────
// Postgres advisory lock — session-scoped, so we pin one connection via
// sqlClient.reserve() for both try_lock and unlock. Auto-released on
// disconnect (crash-safe). Key is hashtext("{source}:{externalId}") which
// Postgres auto-casts int4→bigint for pg_try_advisory_lock.
export async function withSourceLock<T>(
  source: string,
  externalId: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const key = `${source}:${externalId}`;
  const reserved = await sqlClient.reserve();
  try {
    const rows = await reserved<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${key})) AS locked
    `;
    const locked = rows[0]?.locked === true;
    if (!locked) return null;
    try {
      return await fn();
    } finally {
      await reserved`SELECT pg_advisory_unlock(hashtext(${key}))`;
    }
  } finally {
    reserved.release();
  }
}

// ─── Taxonomy resolvers ──────────────────────────────────────────
export async function resolveGenres(
  names: string[],
  group = 'genre',
): Promise<number[]> {
  if (!names.length) return [];
  const slugMap = new Map(names.map((n) => [slugify(n), n]));
  const slugs = [...slugMap.keys()];
  const existing = await db
    .select({ id: schema.genres.id, slug: schema.genres.slug })
    .from(schema.genres)
    .where(inArray(schema.genres.slug, slugs));
  const found = new Set(existing.map((r) => r.slug));
  const missing = slugs.filter((s) => !found.has(s));
  if (missing.length) {
    await db
      .insert(schema.genres)
      .values(missing.map((s) => ({ name: slugMap.get(s)!, slug: s, group })))
      .onConflictDoNothing();
    // Re-query to get correct IDs (positional mapping breaks when conflicts occur)
    const newlyResolved = await db
      .select({ id: schema.genres.id, slug: schema.genres.slug })
      .from(schema.genres)
      .where(inArray(schema.genres.slug, missing));
    existing.push(...newlyResolved);
  }
  const idMap = new Map(
    existing.map((r) => [r.slug, r.id] as [string, number]),
  );
  return slugs.map((s) => idMap.get(s)).filter((id): id is number => !!id);
}

export async function resolveByName(
  table: typeof schema.artists | typeof schema.authors | typeof schema.groups,
  names: string[],
): Promise<number[]> {
  if (!names.length) return [];
  const t = table as typeof schema.artists;
  const slugMap = new Map(names.map((n) => [slugify(n), n]));
  const slugs = [...slugMap.keys()];
  const existing = await db
    .select({ id: t.id, slug: t.slug })
    .from(t)
    .where(inArray(t.slug, slugs));
  const found = new Set(existing.map((r) => r.slug));
  const missing = slugs.filter((s) => !found.has(s));
  if (missing.length) {
    await db
      .insert(t)
      .values(missing.map((s) => ({ name: slugMap.get(s)!, slug: s }) as any))
      .onConflictDoNothing();
    const newlyResolved = await db
      .select({ id: t.id, slug: t.slug })
      .from(t)
      .where(inArray(t.slug, missing));
    existing.push(...newlyResolved);
  }
  const idMap = new Map(
    existing.map((r) => [r.slug, r.id] as [string, number]),
  );
  return slugs.map((s) => idMap.get(s)).filter((id): id is number => !!id);
}

// ─── Manga insert helper ─────────────────────────────────────────
export interface MangaInsertData {
  title: string;
  altTitles: string[];
  description: string | null;
  coverUrl: string | null;
  originalLanguage: string | null;
  status: string;
  type: string;
  contentRating: string;
  demographic: string | null;
  year: number | null;
  genreNames: string[];
  themeNames: string[];
  authorNames: string[];
  artistNames: string[];
  links: { type: string; externalId?: string; url?: string }[];
  source: string;
  externalId: string;
}

export async function upsertManga(
  data: MangaInsertData,
): Promise<{ mangaId: number; isNew: boolean }> {
  // Check if already imported from this source
  const [existingSrc] = await db
    .select({ mangaId: schema.mangaSources.mangaId })
    .from(schema.mangaSources)
    .where(
      and(
        eq(
          schema.mangaSources.source,
          data.source as typeof schema.mangaSources.$inferInsert.source,
        ),
        eq(schema.mangaSources.externalId, data.externalId),
      ),
    )
    .limit(1);
  if (existingSrc) return { mangaId: existingSrc.mangaId, isNew: false };

  // Resolve taxonomy
  const genreIds = await resolveGenres(data.genreNames, 'genre');
  const themeIds = await resolveGenres(data.themeNames, 'theme');
  const allGenreIds = [...new Set([...genreIds, ...themeIds])];
  const artistIds = await resolveByName(schema.artists, data.artistNames);
  const authorIds = await resolveByName(schema.authors, data.authorNames);

  // Slug with collision handling
  const baseSlug = slugify(data.title);
  let slug = baseSlug;
  const [conflict] = await db
    .select({ id: schema.manga.id })
    .from(schema.manga)
    .where(eq(schema.manga.slug, slug))
    .limit(1);
  if (conflict) slug = `${baseSlug}-${Date.now()}`;

  // Insert manga
  const [inserted] = await db
    .insert(schema.manga)
    .values({
      title: data.title,
      altTitles: data.altTitles,
      description: data.description,
      cover: data.coverUrl,
      originalLanguage: data.originalLanguage,
      status: (data.status ||
        'ongoing') as typeof schema.manga.$inferInsert.status,
      type: (data.type || 'manga') as typeof schema.manga.$inferInsert.type,
      contentRating: (data.contentRating ||
        'suggestive') as typeof schema.manga.$inferInsert.contentRating,
      demographic: data.demographic,
      year: data.year,
      slug,
    })
    .returning({ id: schema.manga.id });

  const mangaId = inserted.id;

  // Source mapping
  await db.insert(schema.mangaSources).values({
    mangaId,
    source: data.source as typeof schema.mangaSources.$inferInsert.source,
    externalId: data.externalId,
    lastSyncedAt: new Date(),
  });

  // Pivots
  if (allGenreIds.length)
    await db
      .insert(schema.mangaGenres)
      .values(allGenreIds.map((genreId) => ({ mangaId, genreId })))
      .onConflictDoNothing();
  if (artistIds.length)
    await db
      .insert(schema.mangaArtists)
      .values(artistIds.map((artistId) => ({ mangaId, artistId })))
      .onConflictDoNothing();
  if (authorIds.length)
    await db
      .insert(schema.mangaAuthors)
      .values(authorIds.map((authorId) => ({ mangaId, authorId })))
      .onConflictDoNothing();

  // Links
  for (const link of data.links) {
    await db
      .insert(schema.mangaLinks)
      .values({
        mangaId,
        type: link.type,
        externalId: link.externalId,
        url: link.url,
      })
      .onConflictDoNothing();
  }

  return { mangaId, isNew: true };
}
