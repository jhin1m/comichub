'use client';

import { useRef, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { MangaCarouselCard } from './manga-carousel-card';
import type { MangaListItem, PaginatedResult } from '@/types/manga.types';

const LIMIT = 30;

interface Props {
  initialData: PaginatedResult<MangaListItem>;
}

export function LatestUpdatesSection({ initialData }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState(initialData.page);
  const [items, setItems] = useState(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(total / LIMIT);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  async function goToPage(nextPage: number) {
    startTransition(async () => {
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: String(LIMIT),
          sort: 'updated_at',
          order: 'desc',
        });
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
        const res = await fetch(`${baseUrl}/manga?${params}`);
        const json = await res.json();
        const result: PaginatedResult<MangaListItem> = json.data;

        setPage(result.page);
        setItems(result.data);
        setTotal(result.total);

        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        console.error('Failed to fetch latest updates:', err);
      }
    });
  }

  return (
    <section ref={sectionRef} className="mb-8 scroll-mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5">
        <h2 className="font-rajdhani font-bold text-[20px] text-primary flex-1">Latest Updates</h2>
        <Link
          href="/browse?sort=updated_at"
          className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-secondary hover:bg-hover hover:text-primary transition-colors"
          aria-label="See all"
        >
          <MoreHorizontal size={13} />
        </Link>
      </div>

      {/* Grid */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {items.map((item) => (
          <MangaCarouselCard key={item.id} item={item} />
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-muted text-sm py-8 text-center">No data available</p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            disabled={!hasPrev || isPending}
            onClick={() => goToPage(page - 1)}
            className="flex items-center justify-center gap-1 h-8 rounded-sm bg-elevated border border-default text-secondary hover:bg-hover hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            disabled={!hasNext || isPending}
            onClick={() => goToPage(page + 1)}
            className="flex items-center justify-center gap-1 h-8 rounded-sm bg-elevated border border-default text-secondary hover:bg-hover hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
