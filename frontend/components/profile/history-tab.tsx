'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, MagnifyingGlass, Trash, Spinner } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatRelativeDate } from '@/lib/utils';
import { userApi } from '@/lib/api/user.api';
import type { HistoryItem } from '@/types/user.types';

interface HistoryTabProps {
  items: HistoryItem[];
  onRemoved?: (mangaId: number) => void;
}

export function HistoryTab({ items, onRemoved }: HistoryTabProps) {
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);

  const filtered = search
    ? items.filter((i) => i.manga.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  async function handleRemove(e: React.MouseEvent, mangaId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (removing) return;
    setRemoving(mangaId);
    try {
      await userApi.removeHistory(mangaId);
      toast.success('Removed from history');
      onRemoved?.(mangaId);
    } catch {
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock size={48} className="text-muted mb-4" />
        <p className="text-secondary text-sm mb-2">No history yet</p>
        <p className="text-muted text-xs">Start reading to track your progress</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
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
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-muted text-sm py-8">No matching titles</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((entry) => (
            <Link
              key={entry.id}
              href={entry.chapter ? `/manga/${entry.manga.slug}/${entry.chapter.id}` : `/manga/${entry.manga.slug}`}
              className="group relative block rounded-lg bg-surface border border-default overflow-hidden hover:border-accent transition-colors"
            >
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
                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, entry.mangaId)}
                  disabled={removing === entry.mangaId}
                  className="absolute bottom-1.5 right-1.5 z-10 flex items-center justify-center size-7 rounded-full bg-black/60 text-white/80 hover:bg-red-500/90 hover:text-white backdrop-blur-sm transition-all cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  aria-label="Remove from history"
                >
                  {removing === entry.mangaId
                    ? <Spinner size={12} className="animate-spin" />
                    : <Trash size={12} weight="bold" />}
                </button>
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
                <p className="text-[10px] text-accent font-semibold mt-1">
                  {entry.chapter ? 'Resume →' : 'Start →'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
