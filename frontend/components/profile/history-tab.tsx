'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ClockIcon,
  MagnifyingGlassIcon,
  XIcon,
  SpinnerIcon,
  CheckIcon,
  CheckSquareIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatRelativeDate } from '@/lib/utils';
import { userApi } from '@/lib/api/user.api';
import { getMangaUrl } from '@/lib/utils/manga-url';
import type { HistoryItem } from '@/types/user.types';

interface HistoryTabProps {
  items: HistoryItem[];
  onRemoved?: (mangaIds: number[]) => void;
}

export function HistoryTab({ items, onRemoved }: HistoryTabProps) {
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const filtered = useMemo(
    () =>
      search
        ? items.filter((i) => i.manga.title.toLowerCase().includes(search.toLowerCase()))
        : items,
    [items, search],
  );

  const filteredIds = useMemo(() => filtered.map((i) => i.mangaId), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleSelectMode() {
    setSelectMode((v) => {
      if (v) setSelected(new Set());
      return !v;
    });
  }

  function toggleItem(mangaId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mangaId)) next.delete(mangaId);
      else next.add(mangaId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function handleRemove(e: React.MouseEvent, mangaId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (removing) return;
    setRemoving(mangaId);
    try {
      await userApi.removeHistory(mangaId);
      toast.success('Removed from history');
      onRemoved?.([mangaId]);
    } catch {
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0 || bulkLoading) return;
    const ids = Array.from(selected);
    setBulkLoading(true);
    try {
      await userApi.removeHistoryMany(ids);
      toast.success(`Removed ${ids.length} title${ids.length !== 1 ? 's' : ''}`);
      onRemoved?.(ids);
      setSelected(new Set());
      setSelectMode(false);
    } catch {
      toast.error('Failed to remove');
    } finally {
      setBulkLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ClockIcon size={48} className="text-muted mb-4" />
        <p className="text-secondary text-sm mb-2">No history yet</p>
        <p className="text-muted text-xs">Start reading to track your progress</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Filter history..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full bg-elevated border border-default rounded-md pl-9 pr-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <span className="text-xs text-muted shrink-0">
          {filtered.length} title{filtered.length !== 1 ? 's' : ''}
        </span>
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

      {/* Bulk action bar */}
      {selectMode && (
        <div className="sticky top-0 z-20 flex items-center gap-3 px-3 py-2 bg-surface border border-default rounded-md shadow-sm flex-wrap">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs text-secondary hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <span className={`flex items-center justify-center size-4 rounded border ${allSelected ? 'bg-accent border-accent' : 'border-default bg-elevated'}`}>
              {allSelected && <CheckIcon size={10} weight="bold" className="text-white" />}
            </span>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-xs text-muted">
            {selected.size} selected
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selected.size === 0 || bulkLoading}
            className="h-8 px-3 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
          >
            {bulkLoading ? <SpinnerIcon size={12} className="animate-spin" /> : <XIcon size={12} weight="bold" />}
            Delete{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      )}

      {/* Card grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-muted text-sm py-8">No matching titles</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((entry) => {
            const isSelected = selected.has(entry.mangaId);
            const CardEl: React.ElementType = selectMode ? 'div' : Link;
            const cardProps = selectMode
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-pressed': isSelected,
                  onClick: () => toggleItem(entry.mangaId),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleItem(entry.mangaId);
                    }
                  },
                  className: `group relative block rounded-lg bg-surface border overflow-hidden cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected ? 'border-accent ring-2 ring-accent' : 'border-default hover:border-accent'
                  }`,
                }
              : {
                  href: entry.chapter
                    ? `${getMangaUrl(entry.manga)}/${entry.chapter.id}`
                    : getMangaUrl(entry.manga),
                  className:
                    'group relative block rounded-lg bg-surface border border-default overflow-hidden hover:border-accent transition-colors',
                };
            return (
              <CardEl key={entry.id} {...cardProps}>
                {/* Cover */}
                <div className="relative aspect-2/3 bg-elevated">
                  {entry.manga.cover ? (
                    <Image
                      src={entry.manga.cover}
                      alt={entry.manga.title}
                      fill
                      className="object-cover"
                      sizes="(max-width:640px) 45vw, (max-width:1024px) 22vw, 180px"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">No Cover</div>
                  )}
                  {entry.chapter && (
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
                      Ch.{entry.chapter.number}
                    </span>
                  )}

                  {/* Selection indicator */}
                  {selectMode && (
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span
                        className={`flex items-center justify-center size-6 rounded-full border-2 backdrop-blur-sm transition-all ${
                          isSelected
                            ? 'bg-accent border-accent'
                            : 'bg-black/50 border-white/70'
                        }`}
                      >
                        {isSelected && <CheckIcon size={12} weight="bold" className="text-white" />}
                      </span>
                    </div>
                  )}

                  {/* Remove button (hidden in select mode) */}
                  {!selectMode && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, entry.mangaId)}
                      disabled={removing === entry.mangaId}
                      className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center size-7 rounded-full bg-black/60 text-white/80 hover:bg-red-500/90 hover:text-white backdrop-blur-sm transition-all cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      aria-label="Remove from history"
                    >
                      {removing === entry.mangaId
                        ? <SpinnerIcon size={12} className="animate-spin" />
                        : <XIcon size={12} weight="bold" />}
                    </button>
                  )}
                </div>

                {/* Info */}
                <div className="px-2.5 py-2">
                  <div className="flex items-center justify-between text-[11px] font-rajdhani mb-0.5">
                    <span className="text-secondary">
                      {entry.chapter ? `Ch.${entry.chapter.number}` : 'Not started'}
                    </span>
                    <span className="text-muted" suppressHydrationWarning>
                      {formatRelativeDate(entry.lastReadAt)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-primary line-clamp-1 group-hover:text-accent transition-colors">
                    {entry.manga.title}
                  </p>
                  {!selectMode && (
                    <p className="text-[10px] text-accent font-semibold mt-1">
                      {entry.chapter ? 'Resume →' : 'Start →'}
                    </p>
                  )}
                </div>
              </CardEl>
            );
          })}
        </div>
      )}
    </div>
  );
}
