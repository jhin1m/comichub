'use client';

import { Suspense, useState, useCallback, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { SquaresFourIcon, ListBulletsIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { AdvancedFilterBar } from '@/components/browse/advanced-filter-bar';
import { BrowseResults } from '@/components/browse/browse-results';
import { SearchBar } from '@/components/browse/search-bar';
import PageWrapper from '@/components/layout/page-wrapper';
import type { PaginatedResult, MangaListItem, MangaQueryParams } from '@/types/manga.types';

interface Props {
  initialResult: PaginatedResult<MangaListItem>;
  initialParams: MangaQueryParams;
}

function BrowseContentInner({ initialResult, initialParams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
      if (!('page' in updates)) sp.set('page', '1');
      startTransition(() => {
        router.push(`${pathname}?${sp.toString()}`);
      });
    },
    [searchParams, pathname, router],
  );

  return (
    <PageWrapper className="py-8">
      {/* Search bar + Advanced Filters toggle */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <SearchBar
            initialValue={initialParams.search ?? ''}
            onSearch={(v) => updateParams({ search: v || null })}
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-2 px-4 py-2 border rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
            filtersOpen
              ? 'border-accent text-accent bg-accent/10'
              : 'border-hover text-secondary hover:border-muted hover:text-primary'
          }`}
        >
          <SlidersHorizontalIcon size={14} />
          Advanced Filters
        </button>
      </div>

      {/* Advanced filters panel */}
      <div className="mb-4">
        <AdvancedFilterBar
          currentParams={initialParams}
          onApplyFilters={updateParams}
          isOpen={filtersOpen}
        />
      </div>

      {/* Results count + view toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-secondary">
          {isPending ? 'Loading...' : `${initialResult.total.toLocaleString()} items`}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewMode === 'list' ? 'text-primary bg-hover' : 'text-muted hover:text-secondary'
            }`}
            title="List view"
          >
            <ListBulletsIcon size={18} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewMode === 'grid' ? 'text-primary bg-hover' : 'text-muted hover:text-secondary'
            }`}
            title="Grid view"
          >
            <SquaresFourIcon size={18} />
          </button>
        </div>
      </div>

      {/* Results */}
      <BrowseResults
        result={initialResult}
        isLoading={isPending}
        currentPage={initialParams.page!}
        onPageChange={(p) => updateParams({ page: String(p) })}
        viewMode={viewMode}
      />
    </PageWrapper>
  );
}

export function BrowseContent(props: Props) {
  return (
    <Suspense>
      <BrowseContentInner {...props} />
    </Suspense>
  );
}
