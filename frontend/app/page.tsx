export const dynamic = 'force-dynamic';

import { mangaApi } from '@/lib/api/manga.api';
import { commentApi, type RecentComment } from '@/lib/api/comment.api';
import { MangaCarousel } from '@/components/home/manga-carousel';
import { MangaGrid } from '@/components/home/manga-grid';
import { RecentSidebar } from '@/components/home/recent-sidebar';
import type { MangaListItem, PaginatedResult } from '@/types/manga.types';

export default async function HomePage() {
  let daily: MangaListItem[] = [];
  let weekly: MangaListItem[] = [];
  let latest: MangaListItem[] = [];
  let recent: PaginatedResult<MangaListItem> = { data: [], total: 0, page: 1, limit: 12 };
  let recentComments: RecentComment[] = [];

  try {
    [daily, weekly, latest, recent, recentComments] = await Promise.all([
      mangaApi.rankings('daily', 1, 10),
      mangaApi.rankings('weekly', 1, 10),
      mangaApi.rankings('alltime', 1, 10),
      mangaApi.list({ page: 1, limit: 12, sort: 'updated_at', order: 'desc' }),
      commentApi.recent(10),
    ]);
  } catch {
    // API unavailable — render empty state
  }

  return (
    <main className="max-w-350 mx-auto px-4 py-12">
      {/* 2-column layout: ~70% content + ~30% sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-6">

        {/* Left: manga carousels */}
        <div className="min-w-0">
          <MangaCarousel
            title="Most Recent Popular"
            items={daily}
            showRank
            moreHref="/browse?sort=views"
          />
          <MangaCarousel
            title="Most Follows New Comics"
            items={weekly}
            showRank
            moreHref="/browse?sort=views"
          />
          <MangaGrid
            title="Latest Updates"
            items={latest}
            moreHref="/browse?sort=updated_at"
          />
        </div>

        {/* Right: recently added sidebar */}
        <RecentSidebar items={recent.data} recentComments={recentComments} />
      </div>
    </main>
  );
}
