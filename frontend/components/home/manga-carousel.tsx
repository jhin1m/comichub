'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { MangaCarouselCard } from './manga-carousel-card';
import type { MangaListItem } from '@/types/manga.types';

interface Props {
  title: string;
  items: MangaListItem[];
  showRank?: boolean;
  moreHref?: string;
}

export function MangaCarousel({ title, items = [], showRank = false, moreHref = '/browse' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(items.length > 5);

  const updateButtons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => { updateButtons(); }, [updateButtons]);

  function scroll(dir: number) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.children[0] as HTMLElement | undefined;
    if (!card) return;
    const gap = 12; // gap-3 = 0.75rem = 12px
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: 'smooth' });
  }

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5">
        <h2 className="font-rajdhani font-bold text-[20px] text-[#f5f5f5] flex-1">{title}</h2>

        <button
          onClick={() => scroll(-1)}
          disabled={!canPrev}
          className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-[#2a2a2a] text-[#5a5a5a] disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-[#2e2e2e] hover:enabled:text-[#f5f5f5] transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={() => scroll(1)}
          disabled={!canNext}
          className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-[#2a2a2a] text-[#a0a0a0] disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-[#2e2e2e] hover:enabled:text-[#f5f5f5] transition-colors"
          aria-label="Next"
        >
          <ChevronRight size={13} />
        </button>

        <Link
          href={moreHref}
          className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#2e2e2e] hover:text-[#f5f5f5] transition-colors"
          aria-label="See all"
        >
          <MoreHorizontal size={13} />
        </Link>
      </div>

      {/* Scrollable card track — 1 card per click */}
      {items.length > 0 ? (
        <div
          ref={trackRef}
          onScroll={updateButtons}
          className="flex gap-3 overflow-hidden"
        >
          {items.map((item, i) => (
            <div
              key={item.id}
              className="shrink-0 w-[calc((100%-1.5rem)/3)] sm:w-[calc((100%-2.25rem)/4)] md:w-[calc((100%-3rem)/5)]"
            >
              <MangaCarouselCard item={item} rank={showRank ? i + 1 : undefined} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[#5a5a5a] text-sm py-8 text-center">No data available</p>
      )}
    </section>
  );
}
