import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { MangaCarouselCard } from './manga-carousel-card';
import type { MangaListItem } from '@/types/manga.types';

interface Props {
  title: string;
  items: MangaListItem[];
  moreHref?: string;
}

export function MangaGrid({ title, items = [], moreHref = '/browse' }: Props) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3.5">
        <h2 className="font-rajdhani font-bold text-[20px] text-[#f5f5f5] flex-1">{title}</h2>
        <Link
          href={moreHref}
          className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#2e2e2e] hover:text-[#f5f5f5] transition-colors"
          aria-label="See all"
        >
          <MoreHorizontal size={13} />
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {items.map((item) => (
            <MangaCarouselCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="text-[#5a5a5a] text-sm py-8 text-center">No data available</p>
      )}
    </section>
  );
}
