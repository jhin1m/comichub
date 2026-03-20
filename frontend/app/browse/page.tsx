'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { mangaApi } from '@/lib/api/manga.api';
import { FilterSidebar } from '@/components/browse/filter-sidebar';
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

  const params: MangaQueryParams = {
    page: Number(searchParams.get('page') ?? 1),
    limit: 24,
    search: searchParams.get('search') ?? undefined,
    genre: searchParams.get('genre') ?? undefined,
    status: (searchParams.get('status') as MangaQueryParams['status']) ?? undefined,
    type: (searchParams.get('type') as MangaQueryParams['type']) ?? undefined,
    sort: (searchParams.get('sort') as MangaQueryParams['sort']) ?? 'updated_at',
    order: 'desc',
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
      <div className="mb-6">
        <SearchBar
          initialValue={params.search ?? ''}
          onSearch={(v) => updateParams({ search: v || null })}
        />
      </div>
      <div className="flex gap-6">
        <FilterSidebar currentParams={params} onFilter={updateParams} />
        <BrowseResults
          result={result}
          isLoading={isLoading}
          currentPage={params.page!}
          onPageChange={(p) => updateParams({ page: String(p) })}
        />
      </div>
    </PageWrapper>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<PageWrapper className="py-8"><div className="text-[#5a5a5a]">Loading...</div></PageWrapper>}>
      <BrowseContent />
    </Suspense>
  );
}
