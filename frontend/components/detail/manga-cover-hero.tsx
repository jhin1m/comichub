import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FollowButton } from './follow-button';
import { ReportButton } from './report-button';
import { MangaDescription } from './manga-description';
import { statusVariant } from '@/lib/utils';
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
        <div className="relative w-55 h-80 rounded-sm overflow-hidden bg-elevated border border-default">
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
          <Badge variant={statusVariant(manga.status)}>{manga.status}</Badge>
          <Badge variant="default">{manga.type}</Badge>
          {manga.isHot && <Badge variant="accent">HOT</Badge>}
        </div>

        {/* Title */}
        <h1 className="font-rajdhani font-bold text-2xl text-primary leading-tight">
          {manga.title}
        </h1>

        {manga.altTitles?.length > 0 && (
          <p className="text-secondary text-xs leading-relaxed">{manga.altTitles.join(' / ')}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {firstChapter && (
            <Link href={`/manga/${manga.slug}/${firstChapter.id}`}>
              <Button variant="primary">Start Reading</Button>
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
        <div className="relative w-65 h-90 shrink-0 self-start rounded-sm overflow-hidden bg-elevated border border-default">
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
            <Badge variant={statusVariant(manga.status)}>{manga.status}</Badge>
            <Badge variant="default">{manga.type}</Badge>
            {manga.isHot && <Badge variant="accent">HOT</Badge>}
          </div>

          <h1 className="font-rajdhani font-bold text-3xl text-primary leading-tight">
            {manga.title}
          </h1>

          {manga.altTitles?.length > 0 && (
            <p className="text-secondary text-sm line-clamp-2">{manga.altTitles.join(' / ')}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {firstChapter && (
              <Link href={`/manga/${manga.slug}/${firstChapter.id}`}>
                <Button variant="primary">Start Reading</Button>
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
