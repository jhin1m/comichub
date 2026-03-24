'use client';

import { useRef, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Clock, MoreHorizontal } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MangaCarouselCard } from '@/components/home/manga-carousel-card';
import type { MangaListItem, PaginatedResult } from '@/types/manga.types';

const LIMIT = 30;

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'manhwa', label: 'Manhwa' },
  { value: 'manga', label: 'Manga' },
  { value: 'manhua', label: 'Manhua' },
  { value: 'doujinshi', label: 'Others' },
] as const;

interface Props {
  initialData: PaginatedResult<MangaListItem>;
}

export function LatestUpdatesSection({ initialData }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [page, setPage] = useState(initialData.page);
  const [items, setItems] = useState(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [typeFilter, setTypeFilter] = useState('all');
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(total / LIMIT);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  async function fetchData(targetPage: number, type: string) {
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: String(LIMIT),
      sort: 'updated_at',
      order: 'desc',
    });
    if (type !== 'all') params.set('type', type);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
    const res = await fetch(`${baseUrl}/manga?${params}`);
    const json = await res.json();
    return json.data as PaginatedResult<MangaListItem>;
  }

  function goToPage(nextPage: number) {
    startTransition(async () => {
      try {
        const result = await fetchData(nextPage, typeFilter);
        setPage(result.page);
        setItems(result.data);
        setTotal(result.total);
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        console.error('Failed to fetch latest updates:', err);
      }
    });
  }

  function onTypeChange(value: string) {
    setTypeFilter(value);
    startTransition(async () => {
      try {
        const result = await fetchData(1, value);
        setPage(result.page);
        setItems(result.data);
        setTotal(result.total);
      } catch (err) {
        console.error('Failed to fetch latest updates:', err);
      }
    });
  }

  return (
    <section ref={sectionRef} className="mb-8 scroll-mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5">
        <h2 className="font-rajdhani font-bold text-[20px] text-primary flex-1 flex items-center gap-1.5">
          <Clock size={18} className="text-accent" />
          Latest Updates
        </h2>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-secondary hover:bg-hover hover:text-primary transition-colors"
              aria-label="Filter type"
            >
              <MoreHorizontal size={13} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="bg-elevated border border-default rounded-md overflow-hidden z-50 shadow-lg min-w-[120px]"
            >
              {TYPE_OPTIONS.map((opt) => (
                <DropdownMenu.Item
                  key={opt.value}
                  onSelect={() => onTypeChange(opt.value)}
                  className={`px-3 py-2 text-xs cursor-pointer outline-none select-none hover:bg-hover ${typeFilter === opt.value ? 'text-accent' : 'text-primary'}`}
                >
                  {opt.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
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
