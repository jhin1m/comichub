export const revalidate = 180;

import { buildMeta, SITE_NAME } from '@/lib/seo';
import { mangaApi } from '@/lib/api/manga.api';
import { genreApi } from '@/lib/api/genre.api';
import { statsApi, type PlatformStats } from '@/lib/api/stats.api';
import { commentApi, type RecentComment } from '@/lib/api/comment.api';
import { GenreQuickNav } from '@/components/home/genre-quick-nav';
import { ContinueReadingStrip } from '@/components/home/continue-reading-strip';
import { FollowListStrip } from '@/components/home/follow-list-strip';
import { CommunityStatsBar } from '@/components/home/community-stats-bar';
import { MangaCarousel } from '@/components/home/manga-carousel';
import { LatestUpdatesSection } from '@/components/home/latest-updates-section';
import { RecentSidebar } from '@/components/home/recent-sidebar';
import type { MangaListItem, PaginatedResult, TaxonomyItem } from '@/types/manga.types';

export const metadata = buildMeta({
  title: `${SITE_NAME} — Read Manga Online`,
  description: `Read manga, manhwa, and manhua online for free on ${SITE_NAME}. Daily updates, thousands of titles.`,
  path: '/',
  absoluteTitle: true,
});

export default async function HomePage() {
  const emptyPage = <T,>(limit: number): PaginatedResult<T> => ({ data: [] as T[], total: 0, page: 1, limit });

  // Each fetch is individually resilient — one failure won't blank the whole page
  const [daily, weekly, latestUpdates, recentlyAdded, completeSeries, recentComments, genres, platformStats] = await Promise.all([
    mangaApi.rankings('daily', 1, 10).catch((): MangaListItem[] => []),
    mangaApi.rankings('weekly', 1, 10).catch((): MangaListItem[] => []),
    mangaApi.list({ page: 1, limit: 18, sort: 'updated_at', order: 'desc' }).catch(() => emptyPage<MangaListItem>(18)),
    mangaApi.list({ page: 1, limit: 8, sort: 'created_at', order: 'desc' }).catch(() => emptyPage<MangaListItem>(8)),
    mangaApi.list({ page: 1, limit: 8, status: 'completed', sort: 'updated_at', order: 'desc' }).catch(() => emptyPage<MangaListItem>(8)),
    commentApi.recent(5).catch((): RecentComment[] => []),
    genreApi.list().catch((): TaxonomyItem[] => []),
    statsApi.overview().catch((): PlatformStats | null => null),
  ]);

  return (
    <main>
      {/* Genre quick-nav strip */}
      <GenreQuickNav genres={genres} />

      {/* Continue reading — logged-in users only (client component) */}
      <ContinueReadingStrip />

      {/* Follow list — logged-in users only (client component) */}
      <FollowListStrip />

      {/* Community stats bar */}
      <CommunityStatsBar stats={platformStats} />

      {/* 2-column layout: ~70% content + ~30% sidebar */}
      <div className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 pb-12 pt-4">
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
