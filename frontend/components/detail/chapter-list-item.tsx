import Link from 'next/link';
import { Eye, Clock } from 'lucide-react';
import { formatRelativeDate, formatCount } from '@/lib/utils';
import type { ChapterListItem } from '@/types/manga.types';

interface Props {
  chapter: ChapterListItem;
  mangaSlug: string;
  striped?: boolean;
}

export function ChapterListItemRow({ chapter, mangaSlug, striped }: Props) {
  return (
    <Link
      href={`/manga/${mangaSlug}/${chapter.id}`}
      className={`group flex items-center px-3 py-2.5 border-b border-default/40 hover:bg-hover transition-colors ${
        striped ? 'bg-surface/50' : ''
      }`}
    >
      {/* Chapter number + title */}
      <div className="flex items-center gap-2 w-[140px] shrink-0 min-w-0">
        <span className="text-sm font-semibold text-primary group-hover:text-accent transition-colors">
          Ch. {chapter.number}
        </span>
      </div>

      {/* Title (fills remaining space) */}
      <div className="flex-1 min-w-0 px-2">
        {chapter.title && (
          <span className="text-xs text-secondary truncate block">
            {chapter.title}
          </span>
        )}
      </div>

      {/* Views */}
      <div className="flex items-center gap-1 w-[70px] justify-end shrink-0 text-xs text-muted">
        <Eye size={11} className="opacity-60" />
        <span>{formatCount(chapter.viewCount)}</span>
      </div>

      {/* Date */}
      <div className="flex items-center gap-1 w-[80px] justify-end shrink-0 text-xs text-muted">
        <Clock size={11} className="opacity-60" />
        <span>{formatRelativeDate(chapter.createdAt)}</span>
      </div>
    </Link>
  );
}
