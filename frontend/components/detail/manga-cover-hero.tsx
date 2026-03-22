import Image from 'next/image';
import Link from 'next/link';
import { PixelBadge, PixelButton } from '@pxlkit/ui-kit';
import { FollowButton } from './follow-button';
import { ReportButton } from './report-button';
import { MangaDescription } from './manga-description';
import { statusTone } from '@/lib/utils';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

export function MangaCoverHero({ manga }: Props) {
  const firstChapter = manga.chapters[manga.chapters.length - 1];
  const latestChapter = manga.chapters[0];

  return (
    <div className="space-y-4">
      {/* ===== MOBILE LAYOUT (< lg) ===== */}
      <div className="lg:hidden flex flex-col items-center text-center space-y-4">
        {/* Large centered cover */}
        <div className="relative w-55 h-80 rounded-sm overflow-hidden bg-elevated border border-[#2a2a2a]">
          {manga.cover && (
            <Image
              src={manga.cover}
              alt={manga.title}
              fill
              className="object-cover"
              priority
            />
          )}
        </div>

        {/* Badges */}
        <div className="flex gap-2 flex-wrap justify-center">
          <PixelBadge tone={statusTone(manga.status)}>{manga.status}</PixelBadge>
          <PixelBadge tone="neutral">{manga.type}</PixelBadge>
          {manga.isHot && <PixelBadge tone="red">HOT</PixelBadge>}
        </div>

        {/* Title */}
        <h1 className="font-rajdhani font-bold text-2xl text-[#f5f5f5] leading-tight">
          {manga.title}
        </h1>

        {manga.titleAlt && (
          <p className="text-[#a0a0a0] text-xs leading-relaxed">{manga.titleAlt}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {firstChapter && (
            <Link href={`/manga/${manga.slug}/${firstChapter.id}`}>
              <PixelButton tone="red">Start Reading</PixelButton>
            </Link>
          )}
          <FollowButton mangaId={manga.id} followersCount={manga.followersCount} />
          <ReportButton mangaId={manga.id} firstChapterId={latestChapter?.id} />
        </div>

        {/* Description */}
        <div className="text-left w-full">
          <MangaDescription description={manga.description} />
        </div>
      </div>

      {/* ===== DESKTOP LAYOUT (>= lg) ===== */}
      <div className="hidden lg:flex gap-6">
        {/* Cover */}
        <div className="relative w-65 h-90 shrink-0 self-start rounded-sm overflow-hidden bg-elevated border border-[#2a2a2a]">
          {manga.cover && (
            <Image
              src={manga.cover}
              alt={manga.title}
              fill
              className="object-cover"
              priority
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <PixelBadge tone={statusTone(manga.status)}>{manga.status}</PixelBadge>
            <PixelBadge tone="neutral">{manga.type}</PixelBadge>
            {manga.isHot && <PixelBadge tone="red">HOT</PixelBadge>}
          </div>

          <h1 className="font-rajdhani font-bold text-3xl text-[#f5f5f5] leading-tight">
            {manga.title}
          </h1>

          {manga.titleAlt && (
            <p className="text-[#a0a0a0] text-sm line-clamp-2">{manga.titleAlt}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {firstChapter && (
              <Link href={`/manga/${manga.slug}/${firstChapter.id}`}>
                <PixelButton tone="red">Start Reading</PixelButton>
              </Link>
            )}
            <FollowButton mangaId={manga.id} followersCount={manga.followersCount} />
            <ReportButton mangaId={manga.id} firstChapterId={latestChapter?.id} />
          </div>

          <MangaDescription description={manga.description} />
        </div>
      </div>
    </div>
  );
}
