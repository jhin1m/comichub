'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SparkleIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { formatRelativeDate } from '@/lib/utils';
import { getMangaUrl } from '@/lib/utils/manga-url';
import type { MangaListItem, MangaType, TaxonomyItem } from '@/types/manga.types';
import { LatestComments } from '@/components/home/latest-comments';
import { TrendingTagsWidget } from '@/components/home/trending-tags-widget';
import { CommunityCTACard } from '@/components/home/community-cta-card';
import type { RecentComment } from '@/lib/api/comment.api';

const TYPE_LABEL: Record<MangaType, string> = {
  manga: 'MANGA',
  manhwa: 'MANHWA',
  manhua: 'MANHUA',
  doujinshi: 'OTHER',
};

const TYPE_BADGE: Record<MangaType, string> = {
  manga: 'bg-info/15 text-info',
  manhwa: 'bg-success/15 text-success',
  manhua: 'bg-warning/15 text-warning',
  doujinshi: 'bg-surface text-secondary',
};

function SidebarItem({ item }: { item: MangaListItem }) {
  return (
    <Link
      href={getMangaUrl(item)}
      className="flex gap-3 py-3 border-b border-default last:border-0 group hover:bg-surface/50 -mx-2 px-2 rounded-md transition-colors duration-150"
    >
      {/* Thumbnail — larger */}
      <div className="relative w-14 h-[76px] shrink-0 rounded overflow-hidden bg-elevated border border-default group-hover:border-accent/40 transition-colors duration-200">
        {item.cover ? (
          <Image
            src={item.cover}
            alt={item.title}
            fill
            className="object-cover"
            sizes="56px"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">
            N/A
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1 ${TYPE_BADGE[item.type]}`}>
          {TYPE_LABEL[item.type]}
        </span>
        <p className="text-sm font-medium text-primary line-clamp-2 leading-snug mb-1 group-hover:text-accent transition-colors duration-150">
          {item.title}
        </p>
        <div className="text-xs text-muted font-rajdhani">
          <span className="text-secondary">
            {item.latestChapterNumber ? `Ch.${item.latestChapterNumber}` : 'Ch.0'}
          </span>
          {' · '}
          <span suppressHydrationWarning>{formatRelativeDate(item.updatedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

type Tab = 'recent' | 'complete';

interface Props {
  recentItems: MangaListItem[];
  completeItems: MangaListItem[];
  recentComments?: RecentComment[];
  genres?: TaxonomyItem[];
}

export function RecentSidebar({ recentItems = [], completeItems = [], recentComments = [], genres = [] }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('recent');
  const items = activeTab === 'recent' ? recentItems : completeItems;

  return (
    <aside>
      {/* Tab header with accent underline */}
      <div className="mb-4 flex items-center gap-4 border-b border-default">
        <button
          onClick={() => setActiveTab('recent')}
          className={`font-rajdhani font-bold text-xl pb-2.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5 relative ${
            activeTab === 'recent'
              ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full'
              : 'text-muted hover:text-secondary'
          }`}
        >
          <SparkleIcon size={18} weight={activeTab === 'recent' ? 'fill' : 'regular'} className={activeTab === 'recent' ? 'text-accent' : ''} />
          Recently Added
        </button>
        <button
          onClick={() => setActiveTab('complete')}
          className={`font-rajdhani font-bold text-xl pb-2.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5 relative ${
            activeTab === 'complete'
              ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full'
              : 'text-muted hover:text-secondary'
          }`}
        >
          <CheckCircleIcon size={18} weight={activeTab === 'complete' ? 'fill' : 'regular'} className={activeTab === 'complete' ? 'text-accent' : ''} />
          Complete Series
        </button>
      </div>

      {items.length > 0 ? (
        items.map((item) => <SidebarItem key={item.id} item={item} />)
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <SparkleIcon size={48} className="text-muted mb-4" />
          <p className="text-secondary text-sm">No data available</p>
        </div>
      )}

      <TrendingTagsWidget genres={genres} />

      <LatestComments comments={recentComments} />

      <CommunityCTACard />
    </aside>
  );
}
