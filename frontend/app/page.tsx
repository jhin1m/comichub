export const dynamic = 'force-dynamic';

import { mangaApi } from '@/lib/api/manga.api';
import { genreApi } from '@/lib/api/genre.api';
import { HeroBanner } from '@/components/home/hero-banner';
import { SectionHeader } from '@/components/home/section-header';
import { MangaGrid } from '@/components/manga/manga-grid';
import { LatestUpdatesStrip } from '@/components/home/latest-updates-strip';
import { GenrePills } from '@/components/home/genre-pills';
import PageWrapper from '@/components/layout/page-wrapper';
import type { PaginatedResult, MangaListItem } from '@/types/manga.types';
import type { TaxonomyItem } from '@/types/manga.types';

export default async function HomePage() {
  let hotManga: PaginatedResult<MangaListItem> = { data: [], total: 0, page: 1, limit: 6 };
  let latestManga: PaginatedResult<MangaListItem> = { data: [], total: 0, page: 1, limit: 18 };
  let genres: TaxonomyItem[] = [];

  try {
    [hotManga, latestManga, genres] = await Promise.all([
      mangaApi.hot(1, 6),
      mangaApi.list({ page: 1, limit: 18, sort: 'updated_at', order: 'desc' }),
      genreApi.list(),
    ]);
  } catch {
    // API unavailable — render empty state
  }

  return (
    <main>
      {hotManga.data[0] && <HeroBanner featured={hotManga.data[0]} />}
      <PageWrapper className="py-10 md:py-16 space-y-12">
        <GenrePills genres={genres} />
        <section>
          <SectionHeader title="Popular Manga" href="/browse?sort=views" />
          <MangaGrid items={hotManga.data} />
        </section>
        <section>
          <SectionHeader title="Latest Updates" href="/browse?sort=updated_at" />
          <LatestUpdatesStrip items={latestManga.data} />
        </section>
      </PageWrapper>
    </main>
  );
}
