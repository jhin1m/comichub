'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  MagnifyingGlassIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SquaresFourIcon,
  ListIcon,
  CheckSquareIcon,
  CheckIcon,
  XIcon,
  SpinnerIcon,
  FolderIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { BookmarkTable } from './bookmark-table';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { SWR_KEYS } from '@/lib/swr/swr-keys';
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
  const { mutate } = useSWRConfig();
  const [result, setResult] = useState<PaginatedBookmarks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('bookmark-view') as 'grid' | 'list') || 'grid';
  });

  // Select mode state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [targetFolder, setTargetFolder] = useState<string>('');

  function changeView(mode: 'grid' | 'list') {
    setViewMode(mode);
    localStorage.setItem('bookmark-view', mode);
  }

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

  // Reset selection when page/filters change
  useEffect(() => {
    setSelected(new Set());
  }, [page, search, folderId, sortBy, sortOrder]);

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParams({ search: value || null, page: '1' });
    }, 300);
  }

  function toggleSortOrder() {
    updateParams({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc', page: '1' });
  }

  function toggleSelectMode() {
    setSelectMode((v) => {
      if (v) {
        setSelected(new Set());
        setFolderPickerOpen(false);
      }
      return !v;
    });
  }

  function toggleSelect(mangaId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mangaId)) next.delete(mangaId);
      else next.add(mangaId);
      return next;
    });
  }

  const pageIds = useMemo(() => result?.data.map((i) => i.mangaId) ?? [], [result]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function handleBulkRemove() {
    if (selected.size === 0 || bulkLoading) return;
    const ids = Array.from(selected);
    setBulkLoading(true);
    try {
      await bookmarkApi.removeBookmarkMany(ids);
      toast.success(`Removed ${ids.length} bookmark${ids.length !== 1 ? 's' : ''}`);
      setSelected(new Set());
      setSelectMode(false);
      onFolderChanged();
      fetchBookmarks();
      mutate(SWR_KEYS.USER_BOOKMARK_STRIP);
    } catch {
      toast.error('Failed to remove bookmarks');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkChangeFolder() {
    if (selected.size === 0 || bulkLoading || !targetFolder) return;
    const ids = Array.from(selected);
    setBulkLoading(true);
    try {
      await bookmarkApi.changeFolderMany(ids, Number(targetFolder));
      toast.success(`Moved ${ids.length} bookmark${ids.length !== 1 ? 's' : ''}`);
      setSelected(new Set());
      setSelectMode(false);
      setFolderPickerOpen(false);
      setTargetFolder('');
      onFolderChanged();
      fetchBookmarks();
    } catch {
      toast.error('Failed to change folder');
    } finally {
      setBulkLoading(false);
    }
  }

  function handleSingleRemoved(mangaIds: number[]) {
    // Optimistic filter for immediate feedback, then refetch to sync totalPages & folder counts
    setResult((prev) => {
      if (!prev) return prev;
      const ids = new Set(mangaIds);
      const data = prev.data.filter((item) => !ids.has(item.mangaId));
      return { ...prev, data, total: Math.max(0, prev.total - (prev.data.length - data.length)) };
    });
    onFolderChanged();
    fetchBookmarks();
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
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
          {sortOrder === 'asc' ? <ArrowUpIcon size={14} /> : <ArrowDownIcon size={14} />}
          {sortOrder === 'asc' ? 'Asc' : 'Desc'}
        </button>

        {/* View toggle */}
        <div className="flex rounded-md border border-default overflow-hidden">
          <button
            type="button"
            onClick={() => changeView('grid')}
            className={`h-10 px-2.5 flex items-center transition-colors ${viewMode === 'grid' ? 'bg-accent text-white' : 'bg-elevated text-secondary hover:bg-hover'}`}
            aria-label="Grid view"
          >
            <SquaresFourIcon size={16} />
          </button>
          <button
            type="button"
            onClick={() => changeView('list')}
            className={`h-10 px-2.5 flex items-center transition-colors ${viewMode === 'list' ? 'bg-accent text-white' : 'bg-elevated text-secondary hover:bg-hover'}`}
            aria-label="List view"
          >
            <ListIcon size={16} />
          </button>
        </div>

        {/* Select toggle */}
        <button
          type="button"
          onClick={toggleSelectMode}
          className={`h-10 px-3 rounded-md border text-sm flex items-center gap-1.5 transition-colors ${
            selectMode
              ? 'bg-accent border-accent text-white hover:bg-accent-hover'
              : 'bg-elevated border-default text-secondary hover:bg-hover'
          }`}
        >
          <CheckSquareIcon size={16} />
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* Count + bulk action bar */}
      {selectMode ? (
        <div className="sticky top-0 z-20 flex items-center gap-3 px-3 py-2 bg-surface border border-default rounded-md shadow-sm flex-wrap">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <span className={`flex items-center justify-center size-4 rounded border ${allSelected ? 'bg-accent border-accent' : 'border-default bg-elevated'}`}>
              {allSelected && <CheckIcon size={10} weight="bold" className="text-white" />}
            </span>
            {allSelected ? 'Deselect page' : 'Select page'}
          </button>
          <span className="text-xs text-muted">{selected.size} selected</span>
          <div className="flex-1" />

          {folderPickerOpen ? (
            <div className="flex items-center gap-2">
              <Select value={targetFolder} onValueChange={setTargetFolder}>
                <SelectTrigger className="h-8 text-xs w-[150px]">
                  <SelectValue placeholder="Choose folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={handleBulkChangeFolder}
                disabled={!targetFolder || bulkLoading || selected.size === 0}
                className="h-8 px-3 rounded-md bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {bulkLoading ? <SpinnerIcon size={12} className="animate-spin" /> : <CheckIcon size={12} weight="bold" />}
                Apply
              </button>
              <button
                type="button"
                onClick={() => { setFolderPickerOpen(false); setTargetFolder(''); }}
                className="h-8 px-2 rounded-md text-muted hover:bg-hover text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setFolderPickerOpen(true)}
                disabled={selected.size === 0 || bulkLoading}
                className="h-8 px-3 rounded-md border border-default bg-elevated text-secondary hover:bg-hover text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                <FolderIcon size={12} weight="bold" />
                Change Folder
              </button>
              <button
                type="button"
                onClick={handleBulkRemove}
                disabled={selected.size === 0 || bulkLoading}
                className="h-8 px-3 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                {bulkLoading ? <SpinnerIcon size={12} className="animate-spin" /> : <XIcon size={12} weight="bold" />}
                Delete{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted">
          {isLoading ? 'Loading...' : result ? `${result.total} bookmark${result.total !== 1 ? 's' : ''}` : '0 bookmarks'}
        </div>
      )}

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
          viewMode={viewMode}
          onFolderChanged={() => { onFolderChanged(); fetchBookmarks(); }}
          onRemoved={handleSingleRemoved}
          selectMode={selectMode}
          selected={selected}
          onToggleSelect={toggleSelect}
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
