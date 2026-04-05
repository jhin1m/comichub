'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, BookmarkSimple, Check } from '@phosphor-icons/react';
import { LanguageFlag } from '@/components/ui/language-flag';
import { formatRelativeDate, formatCount } from '@/lib/utils';
import type { ChapterListItem } from '@/types/manga.types';

function isNewChapter(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

interface Props {
  chapter: ChapterListItem;
  mangaSlug: string;
  striped?: boolean;
  isLastRead?: boolean;
  isRead?: boolean;
  onBookmark?: (chapterId: number) => void;
}

export function ChapterListItemRow({ chapter, mangaSlug, striped, isLastRead, isRead, onBookmark }: Props) {
  const router = useRouter();

  const handleRowClick = () => {
    router.push(`/manga/${mangaSlug}/${chapter.id}`);
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmark?.(chapter.id);
  };

  return (
    <div
      onClick={handleRowClick}
      role="link"
      tabIndex={0}
      aria-label={`Read chapter ${chapter.number}`}
      onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
      className={`group relative flex items-center px-4 py-3.5 border-b border-default/40 hover:bg-hover transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset outline-none ${
        striped ? 'bg-surface/50' : ''
      } ${isLastRead ? 'bg-accent/8 border-l-3 border-l-accent' : ''}`}
    >
      {/* Read indicator + Flag + Chapter number + Volume + NEW badge */}
      <div className="flex items-center gap-2.5 shrink-0 min-w-0">
        {/* Read status indicator */}
        {isRead ? (
          <Check size={14} weight="bold" className="text-success shrink-0" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
        )}
        <LanguageFlag lang={chapter.language} />
        <span className={`font-rajdhani font-bold group-hover:text-accent transition-colors whitespace-nowrap ${isRead ? 'text-muted' : 'text-secondary'}`}>
          Ch. {chapter.number}
        </span>
        {chapter.volume && (
          <span className="text-xs font-medium text-accent/80 bg-accent/10 px-2 py-0.5 rounded whitespace-nowrap">
            Vol. {chapter.volume}
          </span>
        )}
        {isNewChapter(chapter.createdAt) && (
          <span className="text-[9px] font-rajdhani font-bold px-1.5 py-0.5 rounded-xs bg-success text-white uppercase tracking-wide">
            NEW
          </span>
        )}
      </div>

      {/* Separator */}
      <span className="text-muted/30 mx-2 shrink-0">—</span>

      {/* Title + Groups (fills remaining space) */}
      <div className="flex-1 min-w-0 px-1">
        {chapter.title && (
          <span className="text-sm text-secondary truncate block">
            {chapter.title}
          </span>
        )}
        {chapter.groups && chapter.groups.length > 0 && (
          <span className="text-xs text-muted truncate block mt-0.5">
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
      <div className="items-center gap-1.5 w-20 justify-end shrink-0 text-sm text-muted hidden sm:flex">
        <Eye size={14} className="opacity-60" />
        <span>{formatCount(chapter.viewCount)}</span>
      </div>

      {/* Date */}
      <span className="w-16 text-right shrink-0 text-sm text-muted" suppressHydrationWarning>
        {formatRelativeDate(chapter.createdAt)}
      </span>

      {/* Bookmark */}
      <button
        onClick={handleBookmarkClick}
        aria-label={isLastRead ? 'Last read chapter' : 'Mark as last read'}
        className={`ml-2 shrink-0 p-1 rounded transition-colors ${
          isLastRead
            ? 'text-accent'
            : 'text-muted hover:text-accent/70'
        }`}
      >
        <BookmarkSimple size={16} weight={isLastRead ? 'fill' : 'regular'} />
      </button>
    </div>
  );
}
