import Link from 'next/link';
import { Eye } from 'lucide-react';
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
      className={`flex items-center justify-between px-3 py-2.5 rounded-[4px] hover:bg-hover transition-colors group ${
        striped ? 'bg-surface' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-primary shrink-0">
          Ch. {chapter.number}
        </span>
        {chapter.title && (
          <span className="text-sm text-secondary truncate group-hover:text-secondary transition-colors">
            {chapter.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Eye size={12} />
          {formatCount(chapter.viewCount)}
        </span>
        <span>{formatRelativeDate(chapter.createdAt)}</span>
      </div>
    </Link>
  );
}
