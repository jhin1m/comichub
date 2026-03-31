import { memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatRelativeDate } from '@/lib/utils';
import { QuickBookmarkButton } from '@/components/manga/quick-bookmark-button';
import type { MangaListItem } from '@/types/manga.types';

// Returns true if manga was updated within the last 7 days
function isNewRelease(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

type CardBadge = { text: string; className: string };

function getCardBadges(item: MangaListItem): CardBadge[] {
  const badges: CardBadge[] = [];

  // P1: Content Rating (when not safe)
  if (item.contentRating === 'pornographic' || item.contentRating === 'erotica') {
    badges.push({ text: '18+', className: 'bg-accent text-white' });
  } else if (item.contentRating === 'suggestive') {
    badges.push({ text: 'S', className: 'bg-warning text-white' });
  }

  // P2: HOT
  if (badges.length < 2 && item.isHot) {
    badges.push({ text: 'HOT', className: 'bg-accent text-white' });
  }

  // P3: NEW (7 days)
  if (badges.length < 2 && isNewRelease(item.updatedAt)) {
    badges.push({ text: 'NEW', className: 'bg-success text-white' });
  }

  // P4: Status (non-ongoing)
  if (badges.length < 2 && item.status !== 'ongoing') {
    const statusMap: Record<string, CardBadge> = {
      completed: { text: 'END', className: 'bg-info text-white' },
      hiatus: { text: 'HIATUS', className: 'bg-warning text-white' },
      dropped: { text: 'DROP', className: 'bg-accent text-white' },
      cancelled: { text: 'DROP', className: 'bg-accent text-white' },
    };
    const s = statusMap[item.status];
    if (s) badges.push(s);
  }

  return badges;
}

// Rank 1=accent red, 2=orange, 3=blue, others=muted white outline
const RANK_STYLES: Record<number, React.CSSProperties> = {
  1: { WebkitTextStroke: '1.5px #e63946', color: 'rgba(230,57,70,0.08)' },
  2: { WebkitTextStroke: '1.5px #f4a261', color: 'rgba(244,162,97,0.08)' },
  3: { WebkitTextStroke: '1.5px #4895ef', color: 'rgba(72,149,239,0.08)' },
};
const RANK_DEFAULT: React.CSSProperties = {
  WebkitTextStroke: '1px rgba(245,245,245,0.25)',
  color: 'rgba(245,245,245,0.04)',
};

interface Props {
  item: MangaListItem;
  rank?: number;
}

export const MangaCard = memo(function MangaCard({ item, rank }: Props) {
  const badges = getCardBadges(item);
  const rankStyle = rank ? (RANK_STYLES[rank] ?? RANK_DEFAULT) : null;

  return (
    <Link href={`/manga/${item.slug}`} className="group block cursor-pointer">
      {/* Cover */}
      <div className="relative aspect-2/3 rounded overflow-hidden bg-surface border border-default mb-2">
        {item.cover ? (
          <Image
            src={item.cover}
            alt={item.title}
            fill
            draggable={false}
            className="object-cover pointer-events-none transition-[filter] duration-150 ease-out group-hover:saturate-150"
            sizes="(max-width:640px) 33vw, (max-width:1024px) 20vw, 180px"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">
            No Cover
          </div>
        )}

        {/* Large rank number — top-right overlay */}
        {rank && rankStyle && (
          <span
            className="absolute top-[-4px] right-1 font-rajdhani font-bold leading-none pointer-events-none select-none"
            style={{ fontSize: '52px', ...rankStyle }}
          >
            {rank}
          </span>
        )}

        {/* Priority badges — top-left stacked */}
        {badges.length > 0 && (
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
            {badges.map((b) => (
              <span key={b.text} className={`${b.className} text-[9px] font-rajdhani font-bold px-1.5 py-0.5 rounded-xs tracking-wide uppercase`}>
                {b.text}
              </span>
            ))}
          </div>
        )}

        {/* Quick bookmark button — visible on mobile, shown on hover on PC */}
        <QuickBookmarkButton mangaId={item.id} />
      </div>

      {/* Chapter + time */}
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-rajdhani font-semibold text-secondary">
          {item.latestChapterNumber ? `Ch.${item.latestChapterNumber}` : 'No ch.'}
        </span>
        <span className="font-rajdhani text-muted" suppressHydrationWarning>{formatRelativeDate(item.updatedAt)}</span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-primary line-clamp-2 leading-snug group-hover:text-accent transition-colors duration-150">
        {item.title}
      </p>
    </Link>
  );
});
