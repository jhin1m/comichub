'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatRelativeDate } from '@/lib/utils';
import type { MangaListItem, MangaType } from '@/types/manga.types';
import { LatestComments } from '@/components/home/latest-comments';
import type { RecentComment } from '@/lib/api/comment.api';

const TYPE_LABEL: Record<MangaType, string> = {
  manga: 'MANGA',
  manhwa: 'MANHWA',
  manhua: 'MANHUA',
  doujinshi: 'OTHER',
};

const TYPE_COLOR: Record<MangaType, string> = {
  manga: 'text-[#4895ef]',
  manhwa: 'text-[#2dc653]',
  manhua: 'text-[#f4a261]',
  doujinshi: 'text-[#a0a0a0]',
};

function SidebarItem({ item }: { item: MangaListItem }) {
  return (
    <Link
      href={`/manga/${item.slug}`}
      className="flex gap-2.5 py-2 border-b border-[#1e1e1e] last:border-0 group"
    >
      {/* Thumbnail */}
      <div className="relative w-13 h-17.5 shrink-0 rounded-[3px] overflow-hidden bg-elevated border border-[#2a2a2a]">
        {item.cover ? (
          <Image
            src={item.cover}
            alt={item.title}
            fill
            className="object-cover"
            sizes="52px"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#5a5a5a] text-[9px]">
            N/A
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`text-[9px] font-bold tracking-widest uppercase mb-0.5 ${TYPE_COLOR[item.type]}`}>
          {TYPE_LABEL[item.type]}
        </div>
        <p className="text-[12px] font-medium text-[#f5f5f5] line-clamp-2 leading-snug mb-1 group-hover:text-accent transition-colors duration-150">
          {item.title}
        </p>
        <div className="text-[11px] text-[#5a5a5a]">
          <span className="text-[#a0a0a0]">
            {item.chaptersCount > 0 ? `Ch.${item.chaptersCount}` : 'Ch.0'}
          </span>
          {' · '}
          {formatRelativeDate(item.updatedAt)}
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
}

export function RecentSidebar({ recentItems = [], completeItems = [], recentComments = [] }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('recent');
  const items = activeTab === 'recent' ? recentItems : completeItems;

  return (
    <aside>
      {/* Tab header */}
      <div className="mb-3 pb-2.5 border-b border-[#2a2a2a] flex items-baseline gap-1">
        <button
          onClick={() => setActiveTab('recent')}
          className={`font-rajdhani font-bold text-[17px] transition-colors cursor-pointer ${
            activeTab === 'recent' ? 'text-[#f5f5f5]' : 'text-[#5a5a5a] hover:text-[#a0a0a0]'
          }`}
        >
          Recently Added
        </button>
        <span className="text-[#5a5a5a] text-[15px] font-medium">/</span>
        <button
          onClick={() => setActiveTab('complete')}
          className={`font-rajdhani font-bold text-[17px] transition-colors cursor-pointer ${
            activeTab === 'complete' ? 'text-[#f5f5f5]' : 'text-[#5a5a5a] hover:text-[#a0a0a0]'
          }`}
        >
          Complete Series
        </button>
      </div>

      {items.length > 0 ? (
        items.map((item) => <SidebarItem key={item.id} item={item} />)
      ) : (
        <p className="text-[#5a5a5a] text-sm py-6 text-center">No data available</p>
      )}

      <LatestComments comments={recentComments} />
    </aside>
  );
}
