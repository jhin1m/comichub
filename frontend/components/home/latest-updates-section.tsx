'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { ClockIcon, DotsThreeOutlineIcon } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MangaCard } from '@/components/manga/manga-card';
import { Pagination } from '@/components/ui/pagination';
import { usePreferencesParams } from '@/hooks/use-preferences-params';
import { apiClient } from '@/lib/api-client';
import type { MangaListItem, PaginatedResult } from '@/types/manga.types';

const LIMIT = 18;

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
  const { params: prefParams, isLoaded: prefsLoaded } = usePreferencesParams();
  const hasRefetched = useRef(false);

  // Re-fetch once preferences are loaded to apply filters on initial data
  useEffect(() => {
    if (!prefsLoaded || hasRefetched.current) return;
    const hasFilters = prefParams.excludeTypes || prefParams.excludeDemographics
      || prefParams.excludeGenres || prefParams.nsfw === false;
    if (!hasFilters) return;
    hasRefetched.current = true;
    fetchData(1, typeFilter).then((result) => {
      setPage(result.page);
      setItems(result.data);
      setTotal(result.total);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded]);

  const totalPages = Math.ceil(total / LIMIT);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  async function fetchData(targetPage: number, type: string) {
    const params: Record<string, string> = {
      page: String(targetPage),
      limit: String(LIMIT),
      sort: 'updated_at',
      order: 'desc',
    };
    if (type !== 'all') params.type = type;
    if (prefParams.excludeTypes) params.excludeTypes = prefParams.excludeTypes;
    if (prefParams.excludeDemographics) params.excludeDemographics = prefParams.excludeDemographics;
    if (prefParams.excludeGenres) params.excludeGenres = prefParams.excludeGenres;
    if (prefParams.nsfw === false) params.nsfw = 'false';

    const res = await apiClient.get<PaginatedResult<MangaListItem>>('/manga', { params });
    return res.data;
  }

  function goToPage(nextPage: number) {
    startTransition(async () => {
      try {
        const result = await fetchData(nextPage, typeFilter);
        setPage(result.page);
        setItems(result.data);
        setTotal(result.total);
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        // fetch failed — keep current data
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
      } catch {
        // fetch failed — keep current data
      }
    });
  }

  return (
    <section ref={sectionRef} className="mb-8 scroll-mt-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5">
        <h2 className="font-rajdhani font-semibold text-2xl text-primary flex-1 flex items-center gap-1.5">
          <ClockIcon size={18} className="text-accent" />
          Latest Updates
        </h2>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-secondary hover:bg-hover hover:text-primary transition-colors"
              aria-label="Filter type"
            >
              <DotsThreeOutlineIcon size={13} />
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
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {items.map((item) => (
          <MangaCard key={item.id} item={item} />
        ))}
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClockIcon size={48} className="text-muted mb-4" />
          <p className="text-secondary text-sm">No data available</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </div>
      )}
    </section>
  );
}
