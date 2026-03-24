'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { SquaresFour, ListBullets, SlidersHorizontal } from '@phosphor-icons/react';
import { mangaApi } from '@/lib/api/manga.api';
import { AdvancedFilterBar } from '@/components/browse/advanced-filter-bar';
import { BrowseResults } from '@/components/browse/browse-results';
import { SearchBar } from '@/components/browse/search-bar';
import PageWrapper from '@/components/layout/page-wrapper';
import type { PaginatedResult, MangaListItem, MangaQueryParams } from '@/types/manga.types';

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [result, setResult] = useState<PaginatedResult<MangaListItem> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const params: MangaQueryParams = {
    page: Number(searchParams.get('page') ?? 1),
    limit: 24,
    search: searchParams.get('search') ?? undefined,
    genre: searchParams.get('genre') ?? undefined, // legacy compat
    status: (searchParams.get('status') as MangaQueryParams['status']) ?? undefined,
    type: (searchParams.get('type') as MangaQueryParams['type']) ?? undefined,
    sort: (searchParams.get('sort') as MangaQueryParams['sort']) ?? 'updated_at',
    order: 'desc',
    artist: searchParams.get('artist') ? Number(searchParams.get('artist')) : undefined,
    author: searchParams.get('author') ? Number(searchParams.get('author')) : undefined,
    includeGenres: searchParams.get('includeGenres') ?? searchParams.get('genre') ?? undefined,
    excludeGenres: searchParams.get('excludeGenres') ?? undefined,
    demographic: searchParams.get('demographic') ?? undefined,
    yearFrom: searchParams.get('yearFrom') ? Number(searchParams.get('yearFrom')) : undefined,
    yearTo: searchParams.get('yearTo') ? Number(searchParams.get('yearTo')) : undefined,
    minChapter: searchParams.get('minChapter') ? Number(searchParams.get('minChapter')) : undefined,
    minRating: searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined,
    nsfw: searchParams.get('nsfw') === 'true' ? true : undefined,
  };

  useEffect(() => {
    setIsLoading(true);
    mangaApi.list(params).then(setResult).finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
      sp.set('page', '1');
      router.push(`${pathname}?${sp.toString()}`);
    },
    [searchParams, pathname, router],
  );

  return (
    <PageWrapper className="py-8">
      {/* Search bar + Advanced Filters toggle */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <SearchBar
            initialValue={params.search ?? ''}
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
          <SlidersHorizontal size={14} />
          Advanced Filters
        </button>
      </div>

      {/* Advanced filters panel */}
      <div className="mb-4">
        <AdvancedFilterBar
          currentParams={params}
          onApplyFilters={updateParams}
          isOpen={filtersOpen}
        />
      </div>

      {/* Results count + view toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-secondary">
          {isLoading ? 'Loading...' : result ? `${result.total.toLocaleString()} items` : '0 items'}
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
            <ListBullets size={18} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewMode === 'grid' ? 'text-primary bg-hover' : 'text-muted hover:text-secondary'
            }`}
            title="Grid view"
          >
            <SquaresFour size={18} />
          </button>
        </div>
      </div>

      {/* Results */}
      <BrowseResults
        result={result}
        isLoading={isLoading}
        currentPage={params.page!}
        onPageChange={(p) => updateParams({ page: String(p) })}
        viewMode={viewMode}
      />
    </PageWrapper>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<PageWrapper className="py-8"><div className="text-muted">Loading...</div></PageWrapper>}>
      <BrowseContent />
    </Suspense>
  );
}
