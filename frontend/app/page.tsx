export const revalidate = 60;

import { buildMeta } from '@/lib/seo';
import { mangaApi } from '@/lib/api/manga.api';
import { commentApi, type RecentComment } from '@/lib/api/comment.api';
import { MangaCarousel } from '@/components/home/manga-carousel';
import { LatestUpdatesSection } from '@/components/home/latest-updates-section';
import { RecentSidebar } from '@/components/home/recent-sidebar';
import type { MangaListItem, PaginatedResult } from '@/types/manga.types';

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

  try {
    [daily, weekly, latestUpdates, recentlyAdded, completeSeries, recentComments] = await Promise.all([
      mangaApi.rankings('daily', 1, 10),
      mangaApi.rankings('weekly', 1, 10),
      mangaApi.list({ page: 1, limit: 18, sort: 'updated_at', order: 'desc' }),
      mangaApi.list({ page: 1, limit: 8, sort: 'created_at', order: 'desc' }),
      mangaApi.list({ page: 1, limit: 8, status: 'completed', sort: 'updated_at', order: 'desc' }),
      commentApi.recent(5),
    ]);
  } catch (err) {
    console.error('Failed to fetch homepage data:', err);
  }

  return (
    <main className="max-w-350 mx-auto px-4 py-12">
      {/* 2-column layout: ~70% content + ~30% sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-6">

        {/* Left: manga carousels */}
        <div className="min-w-0">
          <MangaCarousel
            title="Most Recent Popular"
            iconName="flame"
            items={daily}
            showRank
            moreHref="/browse?sort=views"
            defaultPeriod="daily"
          />
          <MangaCarousel
            title="Most Follows New Comics"
            iconName="heart"
            items={weekly}
            showRank
            moreHref="/browse?sort=views"
            defaultPeriod="weekly"
          />
          <LatestUpdatesSection initialData={latestUpdates} />
        </div>

        {/* Right: recently added sidebar */}
        <RecentSidebar
          recentItems={recentlyAdded.data}
          completeItems={completeSeries.data}
          recentComments={recentComments}
        />
      </div>
    </main>
  );
}
