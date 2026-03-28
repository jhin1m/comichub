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

function statusVariant(status: string): 'success' | 'warning' | 'info' | 'default' {
  if (status === 'ongoing') return 'success';
  if (status === 'completed') return 'info';
  if (status === 'hiatus') return 'warning';
  return 'default';
}

interface BookmarkTableProps {
  items: BookmarkItem[];
  folders: BookmarkFolder[];
  onFolderChanged: () => void;
}

export function BookmarkTable({ items, folders, onFolderChanged }: BookmarkTableProps) {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-muted text-sm">
        No bookmarks found.
      </div>
    );
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-default text-left text-muted text-xs uppercase tracking-wider">
            <th className="py-2 pr-4 font-semibold min-w-[220px]">Title</th>
            <th className="py-2 pr-4 font-semibold whitespace-nowrap">Progress</th>
            <th className="py-2 pr-4 font-semibold">Rating</th>
            <th className="py-2 pr-4 font-semibold min-w-[130px]">Folder</th>
            <th className="py-2 pr-4 font-semibold">Status</th>
            <th className="py-2 pr-4 font-semibold whitespace-nowrap">Updated</th>
            <th className="py-2 pr-4 font-semibold whitespace-nowrap">Last Read</th>
            <th className="py-2 font-semibold whitespace-nowrap">Added</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-default hover:bg-hover/40 transition-colors">
              {/* Title */}
              <td className="py-3 pr-4">
                <Link href={`/manga/${item.manga.slug}`} className="flex items-center gap-3 group">
                  <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-surface">
                    {item.manga.cover ? (
                      <Image
                        src={item.manga.cover}
                        alt={item.manga.title}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="w-full h-full bg-hover" />
                    )}
                  </div>
                  <span className="text-primary group-hover:text-accent transition-colors line-clamp-2 font-medium">
                    {item.manga.title}
                  </span>
                </Link>
              </td>

              {/* Progress */}
              <td className="py-3 pr-4 text-secondary whitespace-nowrap">
                {item.readingProgress?.currentChapterId ? (
                  <Link
                    href={`/manga/${item.manga.slug}/${item.readingProgress.currentChapterId}`}
                    className="hover:text-accent transition-colors"
                  >
                    {item.readingProgress.currentChapter ?? '?'} / {item.manga.chaptersCount}
                  </Link>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>

              {/* Rating */}
              <td className="py-3 pr-4 text-secondary">
                {item.userRating != null ? item.userRating : <span className="text-muted">—</span>}
              </td>

              {/* Folder */}
              <td className="py-3 pr-4">
                <Select
                  value={String(item.folder.id)}
                  onValueChange={(val) => handleFolderChange(item.mangaId, val)}
                >
                  <SelectTrigger className="h-8 text-xs min-w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>

              {/* Status */}
              <td className="py-3 pr-4">
                <Badge variant={statusVariant(item.manga.status)}>
                  {item.manga.status}
                </Badge>
              </td>

              {/* Updated */}
              <td className="py-3 pr-4 text-secondary whitespace-nowrap">
                {timeAgo(item.manga.chapterUpdatedAt)}
              </td>

              {/* Last Read */}
              <td className="py-3 pr-4 text-secondary whitespace-nowrap">
                {timeAgo(item.readingProgress?.lastReadAt ?? null)}
              </td>

              {/* Added */}
              <td className="py-3 text-secondary whitespace-nowrap">
                {timeAgo(item.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
