/**
 * Seed script: Import ~60 popular manga from WeebDex API directly via DB.
 * Usage: cd backend && npx tsx src/database/seed/import-weebdex.seed.ts
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
const TARGET = 60;
let lastReq = 0;

const QUERIES = [
  'one piece',
  'naruto',
  'dragon ball',
  'attack on titan',
  'demon slayer',
  'jujutsu kaisen',
  'my hero academia',
  'chainsaw man',
  'spy x family',
  'solo leveling',
  'tower of god',
  'blue lock',
  'kingdom',
  'berserk',
  'hunter x hunter',
  'bleach',
  'death note',
  'fullmetal alchemist',
  'one punch man',
  'vinland saga',
  'slam dunk',
  'tokyo ghoul',
  'black clover',
  'mob psycho',
  'promised neverland',
  'dorohedoro',
  'dandadan',
  'sakamoto days',
  'kaiju no 8',
  'mashle',
];

const LINK_MAP: Record<string, string> = {
  mal: 'mal',
  al: 'anilist',
  kt: 'kitsu',
  mu: 'mu',
  ap: 'anime-planet',
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 500);
}

async function throttledFetch<T>(path: string): Promise<T> {
  const now = Date.now();
  if (now - lastReq < 210)
    await new Promise((r) => setTimeout(r, 210 - (now - lastReq)));
  lastReq = Date.now();
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

type WDManga = {
  id: string;
  title: string;
  alt_titles?: Record<string, string[]>;
  description?: string;
  year?: number;
  language?: string;
  demographic?: string;
  status?: string;
  content_rating?: string;
  relationships?: {
    cover?: { id: string; ext: string };
    tags?: { group: string; name: string }[];
    authors?: { name: string }[];
    artists?: { name: string }[];
    links?: Record<string, string>;
  };
};

async function resolveGenre(name: string, group: string): Promise<number> {
  const slug = slugify(name);
  const [existing] = await db
    .select({ id: schema.genres.id })
    .from(schema.genres)
    .where(eq(schema.genres.slug, slug))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(schema.genres)
    .values({ name, slug, group })
    .onConflictDoNothing()
    .returning({ id: schema.genres.id });
  return (
    created?.id ??
    (
      await db
        .select({ id: schema.genres.id })
        .from(schema.genres)
        .where(eq(schema.genres.slug, slug))
        .limit(1)
    )[0].id
  );
}

async function resolveTaxonomy(
  table: typeof schema.artists | typeof schema.authors,
  name: string,
): Promise<number> {
  const slug = slugify(name);
  const [existing] = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.slug, slug))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(table)
    .values({ name, slug } as any)
    .onConflictDoNothing()
    .returning({ id: table.id });
  return (
    created?.id ??
    (
      await db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.slug, slug))
        .limit(1)
    )[0].id
  );
}

async function importManga(raw: WDManga): Promise<string> {
  const rels = raw.relationships;
  const tags = rels?.tags ?? [];

  // Resolve taxonomy
  const genreIds: number[] = [];
  for (const t of tags.filter((t) => t.group === 'genre'))
    genreIds.push(await resolveGenre(t.name, 'genre'));
  for (const t of tags.filter((t) => t.group === 'theme'))
    genreIds.push(await resolveGenre(t.name, 'theme'));
  for (const t of tags.filter((t) => t.group === 'format'))
    genreIds.push(await resolveGenre(t.name, 'format'));

  const artistIds: number[] = [];
  for (const a of rels?.artists ?? [])
    artistIds.push(await resolveTaxonomy(schema.artists, a.name));
  const authorIds: number[] = [];
  for (const a of rels?.authors ?? [])
    authorIds.push(await resolveTaxonomy(schema.authors, a.name));

  const altTitles = raw.alt_titles ? Object.values(raw.alt_titles).flat() : [];
  const coverUrl = rels?.cover
    ? `https://weebdex.org/covers/${raw.id}/${rels.cover.id}${rels.cover.ext}`
    : null;
  const inferType = (lang?: string) =>
    lang === 'ko' ? 'manhwa' : lang === 'zh' ? 'manhua' : 'manga';
  const statusMap = (s?: string) =>
    ['ongoing', 'completed', 'hiatus', 'dropped', 'cancelled'].includes(s ?? '')
      ? s!
      : 'ongoing';

  let slug = slugify(raw.title);
  const [conflict] = await db
    .select({ id: schema.manga.id })
    .from(schema.manga)
    .where(eq(schema.manga.slug, slug))
    .limit(1);
  if (conflict) slug = `${slug}-${Date.now()}`;

  const [inserted] = await db
    .insert(schema.manga)
    .values({
      title: raw.title,
      altTitles,
      slug,
      description: raw.description ?? null,
      cover: coverUrl,
      originalLanguage: raw.language ?? null,
      status: statusMap(raw.status) as any,
      type: inferType(raw.language) as any,
      contentRating: (raw.content_rating ?? 'safe') as any,
      demographic: raw.demographic ?? null,
      year: raw.year ?? null,
    })
    .returning({ id: schema.manga.id, slug: schema.manga.slug });

  const mangaId = inserted.id;

  // Source record
  await db.insert(schema.mangaSources).values({
    mangaId,
    source: 'weebdex' as any,
    externalId: raw.id,
    lastSyncedAt: new Date(),
  });

  // Pivots
  if (genreIds.length)
    await db
      .insert(schema.mangaGenres)
      .values([...new Set(genreIds)].map((genreId) => ({ mangaId, genreId })))
      .onConflictDoNothing();
  if (artistIds.length)
    await db
      .insert(schema.mangaArtists)
      .values(
        [...new Set(artistIds)].map((artistId) => ({ mangaId, artistId })),
      )
      .onConflictDoNothing();
  if (authorIds.length)
    await db
      .insert(schema.mangaAuthors)
      .values(
        [...new Set(authorIds)].map((authorId) => ({ mangaId, authorId })),
      )
      .onConflictDoNothing();

  // Links
  const links = rels?.links ?? {};
  for (const [key, val] of Object.entries(links)) {
    if (!LINK_MAP[key]) continue;
    await db
      .insert(schema.mangaLinks)
      .values({ mangaId, type: LINK_MAP[key], externalId: val })
      .onConflictDoNothing();
  }

  return inserted.slug;
}

async function main() {
  const imported = new Set<string>();
  let count = 0;

  console.log(`Importing ~${TARGET} manga from WeebDex...\n`);

  for (const query of QUERIES) {
    if (count >= TARGET) break;
    try {
      const data = await throttledFetch<{ data: WDManga[] }>(
        `/manga?title=${encodeURIComponent(query)}&limit=10`,
      );
      for (const m of data.data) {
        if (count >= TARGET) break;
        if (imported.has(m.id)) continue;
        imported.add(m.id);

        // Check if already in DB
        const [existing] = await db
          .select({ id: schema.mangaSources.id })
          .from(schema.mangaSources)
          .where(
            and(
              eq(schema.mangaSources.source, 'weebdex' as any),
              eq(schema.mangaSources.externalId, m.id),
            ),
          )
          .limit(1);
        if (existing) continue;

        // Fetch full detail
        const full = await throttledFetch<WDManga>(`/manga/${m.id}`);
        try {
          const slug = await importManga(full);
          count++;
          console.log(`  [${count}/${TARGET}] ${full.title} → ${slug}`);
        } catch (err) {
          console.log(`  FAIL ${full.title}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      console.log(`  Search "${query}" failed: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone: ${count} manga imported`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => client.end());
