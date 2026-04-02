#!/usr/bin/env npx tsx --tsconfig tsconfig.json
/**
 * Bulk import manga from WeebDex → ComicHub DB.
 *
 * Usage:
 *   pnpm run import:weebdex                          # default: pages 1-3, lang=all
 *   pnpm run import:weebdex -- --from 1 --to 10      # pages 1-10
 *   pnpm run import:weebdex -- --lang vi              # Vietnamese only
 *   pnpm run import:weebdex -- --lang all             # all languages (default)
 *   pnpm run import:weebdex -- --from 5 --to 5       # single page
 *   pnpm run import:weebdex -- --dry                  # list manga without importing
 */
import {
  db, schema, sqlClient, flag, hasFlag, apiFetch, upsertManga,
  resolveByName, eq, and, desc, count,
} from './import-utils.js';
import { normalizeContentRating } from '../common/utils/content-rating.util.js';

// ─── CLI args ────────────────────────────────────────────────────
const PAGE_FROM = parseInt(flag('from', '1'), 10);
const PAGE_TO = parseInt(flag('to', '3'), 10);
const LANG = flag('lang', 'all');
const DRY_RUN = hasFlag('dry');

const BASE = 'https://api.weebdex.org';
const LINK_TYPE_MAP: Record<string, string> = {
  mal: 'mal', al: 'anilist', kt: 'kitsu', mu: 'mu',
  ap: 'anime-planet', bw: 'bookwalker', nu: 'novelupdates',
  amz: 'amazon', ebj: 'ebookjapan', cdj: 'cdjapan',
  raw: 'raw', engtl: 'official-en',
};

function api<T>(path: string) {
  return apiFetch<T>(BASE, path);
}

// ─── Import single manga ────────────────────────────────────────
async function importOneManga(externalId: string): Promise<{ mangaId: number; isNew: boolean }> {
  const raw = await api<any>(`/manga/${externalId}`);
  const rels = raw.relationships ?? {};
  const tags = rels.tags ?? [];
  const altTitles = raw.alt_titles ? Object.values(raw.alt_titles).flat() as string[] : [];
  const coverUrl = rels.cover?.id && rels.cover?.ext
    ? `https://weebdex.org/covers/${raw.id}/${rels.cover.id}${rels.cover.ext}` : null;

  const inferType = (lang?: string) => lang === 'ko' ? 'manhwa' : lang === 'zh' ? 'manhua' : 'manga';

  return upsertManga({
    title: raw.title, altTitles,
    description: raw.description ?? null, coverUrl,
    originalLanguage: raw.language ?? null,
    status: raw.status ?? 'ongoing',
    type: inferType(raw.language),
    contentRating: normalizeContentRating(raw.content_rating),
    demographic: raw.demographic ?? null,
    year: raw.year ?? null,
    genreNames: tags.filter((t: any) => t.group === 'genre').map((t: any) => t.name),
    themeNames: tags.filter((t: any) => t.group === 'theme').map((t: any) => t.name),
    authorNames: (rels.authors ?? []).map((a: any) => a.name),
    artistNames: (rels.artists ?? []).map((a: any) => a.name),
    links: rels.links
      ? Object.entries(rels.links as Record<string, string>)
          .filter(([k]) => LINK_TYPE_MAP[k])
          .map(([k, v]) => ({ type: LINK_TYPE_MAP[k], externalId: v }))
      : [],
    source: 'weebdex', externalId,
  });
}

// ─── Import chapters for a manga ────────────────────────────────
async function importChapters(mangaId: number, mangaExtId: string): Promise<{ chapters: number; images: number }> {
  let page = 1;
  let totalChapters = 0;
  let totalImages = 0;
  let hasMore = true;

  while (hasMore) {
    const apiData = await api<any>(`/manga/${mangaExtId}/chapters?limit=100&page=${page}`);
    const filtered = LANG === 'all'
      ? apiData.data ?? []
      : (apiData.data ?? []).filter((ch: any) => ch.language === LANG);

    for (const raw of filtered) {
      // Skip if this exact external chapter was already imported
      const [existingSrc] = await db.select({ chapterId: schema.chapterSources.chapterId })
        .from(schema.chapterSources).where(eq(schema.chapterSources.externalId, raw.id)).limit(1);
      if (existingSrc) continue;

      const num = parseFloat(raw.chapter ?? '0');
      const groups = (raw.relationships?.groups ?? []).filter((g: any) => !!g.name);

      // Try insert chapter — may conflict if same number+lang already exists from another group
      const [inserted] = await db.insert(schema.chapters).values({
        mangaId, number: String(num), title: raw.title ?? null,
        slug: `chapter-${num}`, language: raw.language ?? 'en', volume: raw.volume ?? null,
        publishedAt: raw.published_at ? new Date(raw.published_at) : null,
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

      // Source mapping for this external chapter
      await db.insert(schema.chapterSources).values({
        chapterId, source: 'weebdex', externalId: raw.id, lastSyncedAt: new Date(),
      }).onConflictDoNothing();

      // Resolve groups and link to chapter
      let groupId: number | null = null;
      if (groups.length) {
        const groupIds = await resolveByName(schema.groups, groups.map((g: any) => g.name));
        if (groupIds.length) {
          groupId = groupIds[0];
          await db.insert(schema.chapterGroups).values(groupIds.map((gid) => ({ chapterId, groupId: gid }))).onConflictDoNothing();
        }
      }

      // Fetch and insert images with groupId — allows multiple image sets per chapter
      try {
        const imgData = await api<any>(`/chapter/${raw.id}`);
        const images = imgData.data_optimized ?? imgData.data ?? [];
        if (images.length) {
          await db.insert(schema.chapterImages).values(
            images.map((img: any, idx: number) => ({
              chapterId,
              groupId,
              imageUrl: `${imgData.node}/data/${raw.id}/${img.name}`,
              sourceUrl: `${imgData.node}/data/${raw.id}/${img.name}`,
              pageNumber: idx + 1, order: idx + 1,
              width: img.dimensions?.[0] ?? null, height: img.dimensions?.[1] ?? null,
            })),
          ).onConflictDoNothing();
          totalImages += images.length;
        }
      } catch (err: any) {
        console.error(`    Image error ch${num}: ${err.message}`);
      }
    }

    hasMore = (apiData.data?.length ?? 0) === 100;
    page++;
  }

  // Always sync counters — conflicts may leave chaptersCount stale
  const [latest] = await db.select({ id: schema.chapters.id })
    .from(schema.chapters).where(eq(schema.chapters.mangaId, mangaId))
    .orderBy(desc(schema.chapters.order)).limit(1);
  const [{ total }] = await db.select({ total: count() })
    .from(schema.chapters).where(eq(schema.chapters.mangaId, mangaId));
  if (total > 0) {
    await db.update(schema.manga).set({
      lastChapterId: latest?.id ?? null, chaptersCount: total, chapterUpdatedAt: new Date(),
    }).where(eq(schema.manga.id, mangaId));
  }

  return { chapters: totalChapters, images: totalImages };
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  const langLabel = LANG === 'all' ? 'all languages' : LANG;
  console.log(`\nWeebDex Import — pages ${PAGE_FROM}-${PAGE_TO}, lang=${langLabel}${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  const mangaList: { id: string; title: string; langs: string[] }[] = [];
  for (let page = PAGE_FROM; page <= PAGE_TO; page++) {
    const data = await api<any>(`/manga?limit=100&page=${page}`);
    if (!data.data?.length) { console.log(`  Page ${page}: empty, stopping.`); break; }
    for (const m of data.data) {
      const langs: string[] = m.relationships?.available_languages ?? [];
      if (LANG === 'all' || langs.includes(LANG)) mangaList.push({ id: m.id, title: m.title, langs });
    }
    console.log(`  Page ${page}: ${data.data.length} scanned, ${mangaList.length} matched`);
  }

  console.log(`\nFound ${mangaList.length} manga to import\n`);

  if (DRY_RUN) {
    mangaList.forEach((m, i) => console.log(`  ${i + 1}. ${m.title} [${m.langs.join(',')}]`));
    console.log('\n(dry run)');
    await sqlClient.end();
    return;
  }

  let imported = 0, skipped = 0, failed = 0, totalCh = 0, totalImg = 0;
  for (let i = 0; i < mangaList.length; i++) {
    const m = mangaList[i];
    const tag = `[${i + 1}/${mangaList.length}]`;
    try {
      const { mangaId, isNew } = await importOneManga(m.id);
      const r = await importChapters(mangaId, m.id);
      if (isNew) imported++; else skipped++;
      totalCh += r.chapters;
      totalImg += r.images;
      const label = isNew ? '→' : '↻';
      console.log(`${tag} ${m.title} ${label} id:${mangaId}, +${r.chapters} ch, +${r.images} img`);
    } catch (err: any) {
      failed++;
      console.error(`${tag} FAIL ${m.title}: ${err.message}`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Imported: ${imported} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(`Chapters: ${totalCh} | Images: ${totalImg}`);
  console.log(`${'═'.repeat(50)}\n`);
  await sqlClient.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
