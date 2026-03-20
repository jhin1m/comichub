import Link from 'next/link';
import { Eye } from 'lucide-react';
import { formatRelativeDate } from '@/lib/utils';
import type { ChapterListItem } from '@/types/manga.types';

interface Props {
  chapter: ChapterListItem;
  mangaSlug: string;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ChapterListItemRow({ chapter, mangaSlug }: Props) {
  return (
    <Link
      href={`/manga/${mangaSlug}/${chapter.id}`}
      className="flex items-center justify-between px-3 py-2.5 rounded-[4px] hover:bg-elevated transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-[#f5f5f5] shrink-0">
          Ch. {chapter.number}
        </span>
        {chapter.title && (
          <span className="text-sm text-[#a0a0a0] truncate group-hover:text-[#c0c0c0] transition-colors">
            {chapter.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs text-[#707070]">
        <span className="flex items-center gap-1">
          <Eye size={12} />
          {formatCount(chapter.viewCount)}
        </span>
        <span>{formatRelativeDate(chapter.createdAt)}</span>
      </div>
    </Link>
  );
}
