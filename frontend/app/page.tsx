export const revalidate = 180;

import { buildMeta } from '@/lib/seo';
import { mangaApi } from '@/lib/api/manga.api';
import { genreApi } from '@/lib/api/genre.api';
import { statsApi, type PlatformStats } from '@/lib/api/stats.api';
import { commentApi, type RecentComment } from '@/lib/api/comment.api';
import { GenreQuickNav } from '@/components/home/genre-quick-nav';
import { ContinueReadingStrip } from '@/components/home/continue-reading-strip';
import { CommunityStatsBar } from '@/components/home/community-stats-bar';
import { MangaCarousel } from '@/components/home/manga-carousel';
import { LatestUpdatesSection } from '@/components/home/latest-updates-section';
import { RecentSidebar } from '@/components/home/recent-sidebar';
import type { MangaListItem, PaginatedResult, TaxonomyItem } from '@/types/manga.types';

export const metadata = buildMeta({
  title: 'ComicHub — Read Manga Online',
  description: 'Read manga, manhwa, and manhua online for free on ComicHub. Daily updates, thousands of titles.',
  path: '/',
  absoluteTitle: true,
});

export default async function HomePage() {
  let daily: MangaListItem[] = [];
  let weekly: MangaListItem[] = [];
  let latestUpdates: PaginatedResult<MangaListItem> = { data: [], total: 0, page: 1, limit: 18 };
  let recentlyAdded: PaginatedResult<MangaListItem> = { data: [], total: 0, page: 1, limit: 8 };
  let completeSeries: PaginatedResult<MangaListItem> = { data: [], total: 0, page: 1, limit: 8 };
  let recentComments: RecentComment[] = [];
  let genres: TaxonomyItem[] = [];
  let platformStats: PlatformStats | null = null;

  try {
    [daily, weekly, latestUpdates, recentlyAdded, completeSeries, recentComments, genres, platformStats] = await Promise.all([
      mangaApi.rankings('daily', 1, 10),
      mangaApi.rankings('weekly', 1, 10),
      mangaApi.list({ page: 1, limit: 18, sort: 'updated_at', order: 'desc' }),
      mangaApi.list({ page: 1, limit: 8, sort: 'created_at', order: 'desc' }),
      mangaApi.list({ page: 1, limit: 8, status: 'completed', sort: 'updated_at', order: 'desc' }),
      commentApi.recent(5),
      genreApi.list(),
      statsApi.overview().catch(() => null),
    ]);
  } catch (err) {
    console.error('Failed to fetch homepage data:', err);
  }

  return (
    <main>
      {/* Genre quick-nav strip */}
      <GenreQuickNav genres={genres} />

      {/* Continue reading — logged-in users only (client component) */}
      <ContinueReadingStrip />

      {/* Community stats bar */}
      <CommunityStatsBar stats={platformStats} />

      {/* 2-column layout: ~70% content + ~30% sidebar */}
      <div className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-6">

          {/* Left: manga carousels + latest updates */}
          <div className="min-w-0">
            <MangaCarousel
              title="Most Recent Popular"
              iconName="flame"
              items={daily}
              showRank
              defaultPeriod="daily"
            />
            <MangaCarousel
              title="Most Follows New Comics"
              iconName="heart"
              items={weekly}
              showRank
              defaultPeriod="weekly"
            />
            <LatestUpdatesSection initialData={latestUpdates} />
          </div>

          {/* Right: sidebar with recent, tags, comments, CTA */}
          <RecentSidebar
            recentItems={recentlyAdded.data}
            completeItems={completeSeries.data}
            recentComments={recentComments}
            genres={genres}
          />
        </div>
      </div>
    </main>
  );
}
