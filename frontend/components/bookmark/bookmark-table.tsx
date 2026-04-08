'use client';

import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { bookmarkApi } from '@/lib/api/bookmark.api';
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
}

export function BookmarkTable({ items, folders, viewMode, onFolderChanged }: BookmarkTableProps) {
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

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {items.map((item) => {
          const progress = getProgress(item);
          return (
            <Link
              key={item.id}
              href={
                item.readingProgress?.currentChapterId
                  ? `/manga/${item.manga.slug}/${item.readingProgress.currentChapterId}`
                  : `/manga/${item.manga.slug}`
              }
              className="group relative block rounded-lg bg-surface border border-default overflow-hidden hover:border-accent transition-colors"
            >
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
            </Link>
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
        return (
          <div key={item.id} className="flex items-center gap-3 py-3 border-b border-default hover:bg-hover/40 transition-colors">
            {/* Cover thumbnail */}
            <Link href={`/manga/${item.manga.slug}`} className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-elevated">
              {item.manga.cover ? (
                <Image src={item.manga.cover} alt={item.manga.title} fill className="object-cover" sizes="40px" />
              ) : (
                <div className="w-full h-full bg-hover" />
              )}
            </Link>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <Link href={`/manga/${item.manga.slug}`} className="text-sm font-medium text-primary hover:text-accent transition-colors line-clamp-1">
                {item.manga.title}
              </Link>
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

            {/* Folder select */}
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
        );
      })}
    </div>
  );
}
