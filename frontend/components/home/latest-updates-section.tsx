'use client';

import { Suspense, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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

function LatestUpdatesSectionInner({ initialData }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionRef = useRef<HTMLElement>(null);

  const urlPage = Number(searchParams.get('page')) || 1;

  const [items, setItems] = useState(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [typeFilter, setTypeFilter] = useState('all');
  const [isPending, startTransition] = useTransition();
  const { params: prefParams, isLoaded: prefsLoaded } = usePreferencesParams();
  const hasRefetched = useRef(false);
  const currentDataPage = useRef(1);

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
    if (prefParams.nsfw === true) params.nsfw = 'true';

    const res = await apiClient.get<PaginatedResult<MangaListItem>>('/manga', { params });
    return res.data;
  }

  // Fetch when URL page changes (browser back/forward or deep link)
  useEffect(() => {
    if (urlPage === currentDataPage.current) return;
    startTransition(async () => {
      try {
        const result = await fetchData(urlPage, typeFilter);
        currentDataPage.current = result.page;
        setItems(result.data);
        setTotal(result.total);
      } catch {
        // fetch failed — keep current data
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPage]);

  // Re-fetch once preferences are loaded to apply filters
  useEffect(() => {
    if (!prefsLoaded || hasRefetched.current) return;
    const hasFilters = prefParams.excludeTypes || prefParams.excludeDemographics
      || prefParams.excludeGenres || prefParams.nsfw === true;
    if (!hasFilters) return;
    hasRefetched.current = true;
    fetchData(urlPage, typeFilter).then((result) => {
      currentDataPage.current = result.page;
      setItems(result.data);
      setTotal(result.total);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsLoaded]);

  const totalPages = Math.ceil(total / LIMIT);

  function pushUrl(targetPage: number) {
    const sp = new URLSearchParams(searchParams.toString());
    if (targetPage <= 1) sp.delete('page');
    else sp.set('page', String(targetPage));
    const query = sp.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  }

  function goToPage(nextPage: number) {
    pushUrl(nextPage);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onTypeChange(value: string) {
    setTypeFilter(value);
    currentDataPage.current = 1;
    pushUrl(1);
    startTransition(async () => {
      try {
        const result = await fetchData(1, value);
        currentDataPage.current = result.page;
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
            currentPage={urlPage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </div>
      )}
    </section>
  );
}

export function LatestUpdatesSection(props: Props) {
  return (
    <Suspense>
      <LatestUpdatesSectionInner {...props} />
    </Suspense>
  );
}
