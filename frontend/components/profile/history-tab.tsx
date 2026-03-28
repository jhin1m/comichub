'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ClockIcon, TrashIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { formatRelativeDate } from '@/lib/utils';
import { userApi } from '@/lib/api/user.api';
import type { HistoryItem } from '@/types/user.types';

interface HistoryTabProps {
  items: HistoryItem[];
  onRemoved?: (mangaId: number) => void;
}

export function HistoryTab({ items, onRemoved }: HistoryTabProps) {
  async function handleRemove(mangaId: number) {
    try {
      await userApi.removeHistory(mangaId);
      toast.success('Removed from history');
      onRemoved?.(mangaId);
    } catch {
      toast.error('Failed to remove');
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-default text-left text-muted text-xs uppercase tracking-wider">
            <th className="py-2 pr-4 font-semibold min-w-[220px]">Title</th>
            <th className="py-2 pr-4 font-semibold whitespace-nowrap">Chapter</th>
            <th className="py-2 pr-4 font-semibold whitespace-nowrap">Last Read</th>
            <th className="py-2 font-semibold w-10" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-default hover:bg-hover/40 transition-colors">
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

              <td className="py-3 pr-4 text-secondary whitespace-nowrap">
                {item.chapter ? (
                  <Link
                    href={`/manga/${item.manga.slug}/${item.chapter.id}`}
                    className="hover:text-accent transition-colors"
                  >
                    Ch. {item.chapter.number}
                  </Link>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>

              <td className="py-3 pr-4 text-secondary whitespace-nowrap">
                {formatRelativeDate(item.lastReadAt)}
              </td>

              <td className="py-3">
                <button
                  type="button"
                  onClick={() => handleRemove(item.mangaId)}
                  className="p-1.5 text-muted hover:text-red-400 hover:bg-hover rounded transition-colors"
                  title="Remove from history"
                >
                  <TrashIcon size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
