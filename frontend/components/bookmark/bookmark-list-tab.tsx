'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { MagnifyingGlass, ArrowUp, ArrowDown } from '@phosphor-icons/react';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { BookmarkTable } from './bookmark-table';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import type { BookmarkItem, BookmarkFolder } from '@/types/bookmark.types';

interface PaginatedBookmarks {
  data: BookmarkItem[];
  total: number;
  page: number;
  totalPages: number;
}

const SORT_OPTIONS = [
  { value: 'updated', label: 'Updated' },
  { value: 'lastRead', label: 'Last Read' },
  { value: 'added', label: 'Added' },
  { value: 'title', label: 'Title' },
];

interface BookmarkListTabProps {
  folders: BookmarkFolder[];
  onFolderChanged: () => void;
}

export function BookmarkListTab({ folders, onFolderChanged }: BookmarkListTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [result, setResult] = useState<PaginatedBookmarks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const page = Number(searchParams.get('page') ?? 1);
  const search = searchParams.get('search') ?? '';
  const folderId = searchParams.get('folderId') ?? '';
  const sortBy = searchParams.get('sortBy') ?? 'updated';
  const sortOrder = searchParams.get('sortOrder') ?? 'desc';

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
      router.push(`${pathname}?${sp.toString()}`);
    },
    [searchParams, pathname, router],
  );

  const fetchBookmarks = useCallback(() => {
    setIsLoading(true);
    const params: Record<string, unknown> = { page, limit: 20, sortBy, sortOrder };
    if (search) params.search = search;
    if (folderId) params.folderId = Number(folderId);
    bookmarkApi
      .getBookmarks(params)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setIsLoading(false));
  }, [page, search, folderId, sortBy, sortOrder]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ search: value || null, page: '1' });
    }, 300);
  }

  function toggleSortOrder() {
    updateParams({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc', page: '1' });
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search bookmarks..."
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-10 w-full bg-elevated border border-default rounded-md pl-9 pr-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Folder filter */}
        <Select
          value={folderId || 'all'}
          onValueChange={(v) => updateParams({ folderId: v === 'all' ? null : v, page: '1' })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Folders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Folders</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>
                {f.name} ({f.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort by */}
        <Select
          value={sortBy}
          onValueChange={(v) => updateParams({ sortBy: v, page: '1' })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort order */}
        <button
          type="button"
          onClick={toggleSortOrder}
          className="h-10 px-3 bg-elevated border border-default rounded-md text-secondary hover:bg-hover transition-colors flex items-center gap-1.5 text-sm"
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          {sortOrder === 'asc' ? 'Asc' : 'Desc'}
        </button>
      </div>

      {/* Count */}
      <div className="text-xs text-muted">
        {isLoading ? 'Loading...' : result ? `${result.total} bookmark${result.total !== 1 ? 's' : ''}` : '0 bookmarks'}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-hover rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <BookmarkTable
          items={result?.data ?? []}
          folders={folders}
          onFolderChanged={() => { onFolderChanged(); fetchBookmarks(); }}
        />
      )}

      {/* Pagination */}
      {result && result.totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination
            currentPage={page}
            totalPages={result.totalPages}
            onPageChange={(p) => updateParams({ page: String(p) })}
          />
        </div>
      )}
    </div>
  );
}
