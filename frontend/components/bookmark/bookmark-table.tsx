'use client';

import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { XIcon, SpinnerIcon, CheckIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { getMangaUrl } from '@/lib/utils/manga-url';
import type { BookmarkItem, BookmarkFolder } from '@/types/bookmark.types';

function timeAgo(date: string | null): string {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 2592000)}mo`;
}

function statusBadgeClass(status: string): string {
  if (status === 'ongoing') return 'bg-success text-white';
  if (status === 'completed') return 'bg-info text-white';
  if (status === 'hiatus') return 'bg-warning text-white';
  return 'bg-elevated text-secondary';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = { ongoing: 'ONGOING', completed: 'END', hiatus: 'HIATUS', dropped: 'DROP', cancelled: 'DROP' };
  return labels[status] ?? status.toUpperCase();
}

function statusVariant(status: string): 'success' | 'warning' | 'info' | 'default' {
  if (status === 'ongoing') return 'success';
  if (status === 'completed') return 'info';
  if (status === 'hiatus') return 'warning';
  return 'default';
}

function getProgress(item: BookmarkItem): { text: string; percent: number } {
  const current = item.readingProgress?.currentChapter;
  const total = item.manga.chaptersCount;
  if (!current) return { text: `—/${total}`, percent: 0 };
  const num = parseFloat(current);
  const percent = total > 0 ? Math.min((num / total) * 100, 100) : 0;
  return { text: `${current}/${total}`, percent };
}

interface BookmarkTableProps {
  items: BookmarkItem[];
  folders: BookmarkFolder[];
  viewMode: 'grid' | 'list';
  onFolderChanged: () => void;
  onRemoved: (mangaIds: number[]) => void;
  selectMode: boolean;
  selected: Set<number>;
  onToggleSelect: (mangaId: number) => void;
}

export function BookmarkTable({
  items,
  folders,
  viewMode,
  onFolderChanged,
  onRemoved,
  selectMode,
  selected,
  onToggleSelect,
}: BookmarkTableProps) {
  const [removing, setRemoving] = useState<number | null>(null);

  if (items.length === 0) {
    return <div className="py-16 text-center text-muted text-sm">No bookmarks found.</div>;
  }

  async function handleFolderChange(mangaId: number, folderId: string) {
    try {
      await bookmarkApi.changeFolder(mangaId, Number(folderId));
      toast.success('Folder updated');
      onFolderChanged();
    } catch {
      toast.error('Failed to update folder');
    }
  }

  async function handleRemove(e: React.MouseEvent, mangaId: number) {
    e.preventDefault();
    e.stopPropagation();
    if (removing) return;
    setRemoving(mangaId);
    try {
      await bookmarkApi.removeBookmark(mangaId);
      toast.success('Removed from bookmarks');
      onRemoved([mangaId]);
    } catch {
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {items.map((item) => {
          const progress = getProgress(item);
          const isSelected = selected.has(item.mangaId);
          const CardEl: React.ElementType = selectMode ? 'div' : Link;
          const cardProps = selectMode
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-pressed': isSelected,
                onClick: () => onToggleSelect(item.mangaId),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleSelect(item.mangaId);
                  }
                },
                className: `group relative block rounded-lg bg-surface border overflow-hidden cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected ? 'border-accent ring-2 ring-accent' : 'border-default hover:border-accent'
                }`,
              }
            : {
                href: item.readingProgress?.currentChapterId
                  ? `${getMangaUrl(item.manga)}/${item.readingProgress.currentChapterId}`
                  : getMangaUrl(item.manga),
                className:
                  'group relative block rounded-lg bg-surface border border-default overflow-hidden hover:border-accent transition-colors',
              };
          return (
            <CardEl key={item.id} {...cardProps}>
              {/* Cover */}
              <div className="relative aspect-2/3 bg-elevated">
                {item.manga.cover ? (
                  <Image
                    src={item.manga.cover}
                    alt={item.manga.title}
                    fill
                    className="object-cover"
                    sizes="(max-width:640px) 45vw, (max-width:1024px) 22vw, 180px"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">No Cover</div>
                )}
                {/* Status badge */}
                <span className={`absolute top-1.5 left-1.5 text-[9px] font-rajdhani font-bold px-1.5 py-0.5 rounded-xs tracking-wide uppercase ${statusBadgeClass(item.manga.status)}`}>
                  {statusLabel(item.manga.status)}
                </span>
                {/* Progress text */}
                <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
                  Ch.{progress.text}
                </span>
                {/* Progress bar */}
                {progress.percent > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                    <div className="h-full bg-accent" style={{ width: `${progress.percent}%` }} />
                  </div>
                )}

                {/* Selection indicator */}
                {selectMode && (
                  <div className="absolute top-1.5 right-1.5 z-10">
                    <span
                      className={`flex items-center justify-center size-6 rounded-full border-2 backdrop-blur-sm transition-all ${
                        isSelected ? 'bg-accent border-accent' : 'bg-black/50 border-white/70'
                      }`}
                    >
                      {isSelected && <CheckIcon size={12} weight="bold" className="text-white" />}
                    </span>
                  </div>
                )}

                {/* Remove button */}
                {!selectMode && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, item.mangaId)}
                    disabled={removing === item.mangaId}
                    className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center size-7 rounded-full bg-black/60 text-white/80 hover:bg-red-500/90 hover:text-white backdrop-blur-sm transition-all cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Remove from bookmarks"
                  >
                    {removing === item.mangaId
                      ? <SpinnerIcon size={12} className="animate-spin" />
                      : <XIcon size={12} weight="bold" />}
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="px-2.5 py-2">
                <p className="text-xs font-medium text-primary line-clamp-1 group-hover:text-accent transition-colors">
                  {item.manga.title}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-muted mt-1">
                  <span className="line-clamp-1">{item.folder.name}</span>
                  <span>·</span>
                  <span className="shrink-0" suppressHydrationWarning>{timeAgo(item.manga.chapterUpdatedAt)}</span>
                </div>
              </div>
            </CardEl>
          );
        })}
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div className="space-y-0">
      {items.map((item) => {
        const progress = getProgress(item);
        const isSelected = selected.has(item.mangaId);
        return (
          <div
            key={item.id}
            role={selectMode ? 'button' : undefined}
            tabIndex={selectMode ? 0 : undefined}
            aria-pressed={selectMode ? isSelected : undefined}
            onClick={selectMode ? () => onToggleSelect(item.mangaId) : undefined}
            onKeyDown={
              selectMode
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleSelect(item.mangaId);
                    }
                  }
                : undefined
            }
            className={`flex items-center gap-3 py-3 px-2 border-b border-default transition-colors focus:outline-none ${
              selectMode
                ? `cursor-pointer focus-visible:ring-2 focus-visible:ring-accent ${isSelected ? 'bg-accent/10' : 'hover:bg-hover/40'}`
                : 'hover:bg-hover/40'
            }`}
          >
            {/* Selection checkbox */}
            {selectMode && (
              <span
                className={`flex items-center justify-center size-5 rounded border-2 shrink-0 transition-colors ${
                  isSelected ? 'bg-accent border-accent' : 'bg-elevated border-default'
                }`}
              >
                {isSelected && <CheckIcon size={12} weight="bold" className="text-white" />}
              </span>
            )}

            {/* Cover thumbnail */}
            {selectMode ? (
              <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-elevated">
                {item.manga.cover ? (
                  <Image src={item.manga.cover} alt={item.manga.title} fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="w-full h-full bg-hover" />
                )}
              </div>
            ) : (
              <Link href={getMangaUrl(item.manga)} className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-elevated">
                {item.manga.cover ? (
                  <Image src={item.manga.cover} alt={item.manga.title} fill className="object-cover" sizes="40px" />
                ) : (
                  <div className="w-full h-full bg-hover" />
                )}
              </Link>
            )}

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              {selectMode ? (
                <span className="text-sm font-medium text-primary line-clamp-1">
                  {item.manga.title}
                </span>
              ) : (
                <Link href={getMangaUrl(item.manga)} className="text-sm font-medium text-primary hover:text-accent transition-colors line-clamp-1">
                  {item.manga.title}
                </Link>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-secondary mt-0.5">
                <span>Ch.{progress.text}</span>
                {item.userRating != null && <span>★{item.userRating}</span>}
                <span className="text-muted" suppressHydrationWarning>{timeAgo(item.manga.chapterUpdatedAt)}</span>
              </div>
            </div>

            {/* Status */}
            <Badge variant={statusVariant(item.manga.status)} className="hidden sm:inline-flex shrink-0">
              {item.manga.status}
            </Badge>

            {/* Folder select (hidden in select mode to avoid click conflicts) */}
            {!selectMode && (
              <>
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={String(item.folder.id)}
                    onValueChange={(val) => handleFolderChange(item.mangaId, val)}
                  >
                    <SelectTrigger className="h-8 text-xs min-w-[100px] max-w-[130px] hidden md:flex shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, item.mangaId)}
                  disabled={removing === item.mangaId}
                  className="flex items-center justify-center size-8 rounded-full text-muted hover:bg-red-500/20 hover:text-red-500 transition-colors shrink-0"
                  aria-label="Remove from bookmarks"
                >
                  {removing === item.mangaId
                    ? <SpinnerIcon size={14} className="animate-spin" />
                    : <XIcon size={14} weight="bold" />}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
