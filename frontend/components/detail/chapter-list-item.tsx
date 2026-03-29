'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Clock } from '@phosphor-icons/react';
import { LanguageFlag } from '@/components/ui/language-flag';
import { formatRelativeDate, formatCount } from '@/lib/utils';
import type { ChapterListItem } from '@/types/manga.types';

interface Props {
  chapter: ChapterListItem;
  mangaSlug: string;
  striped?: boolean;
}

export function ChapterListItemRow({ chapter, mangaSlug, striped }: Props) {
  const router = useRouter();

  const handleRowClick = () => {
    router.push(`/manga/${mangaSlug}/${chapter.id}`);
  };

  return (
    <div
      onClick={handleRowClick}
      role="link"
      tabIndex={0}
      aria-label={`Read chapter ${chapter.number}`}
      onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
      className={`group flex items-center px-3 py-2.5 border-b border-default/40 hover:bg-hover transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset outline-none ${
        striped ? 'bg-surface/50' : ''
      }`}
    >
      {/* Flag + Chapter number + Volume */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <LanguageFlag lang={chapter.language} />
        <span className="text-sm font-rajdhani font-semibold text-secondary group-hover:text-accent transition-colors whitespace-nowrap">
          Ch. {chapter.number}
        </span>
        {chapter.volume && (
          <span className="text-[10px] font-medium text-accent/80 bg-accent/10 px-1.5 py-0.5 rounded whitespace-nowrap">
            Vol. {chapter.volume}
          </span>
        )}
      </div>

      {/* Separator */}
      <span className="text-muted/30 mx-1 shrink-0">—</span>

      {/* Title + Groups (fills remaining space) */}
      <div className="flex-1 min-w-0 px-1">
        {chapter.title && (
          <span className="text-xs text-secondary truncate block">
            {chapter.title}
          </span>
        )}
        {chapter.groups && chapter.groups.length > 0 && (
          <span className="text-[10px] text-muted truncate block">
            {chapter.groups.map((g, i) => (
              <span key={g.id}>
                {i > 0 && ', '}
                <Link
                  href={`/groups/${g.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-accent transition-colors"
                >
                  {g.name}
                </Link>
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Views */}
      <div className="flex items-center gap-1 w-17.5 justify-end shrink-0 text-xs text-muted">
        <Eye size={11} className="opacity-60" />
        <span>{formatCount(chapter.viewCount)}</span>
      </div>

      {/* Date */}
      <div className="flex items-center gap-1 w-20 justify-end shrink-0 text-xs text-muted">
        <Clock size={11} className="opacity-60" />
        <span>{formatRelativeDate(chapter.createdAt)}</span>
      </div>
    </div>
  );
}
