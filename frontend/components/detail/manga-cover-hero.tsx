import Image from 'next/image';
import Link from 'next/link';
import { Play, Eye, Users, BookOpen } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FollowButton } from './follow-button';
import { ReportButton } from './report-button';
import { MangaDescription } from './manga-description';

import { statusVariant, formatCount } from '@/lib/utils';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

function StatItem({ icon: Icon, value }: { icon: typeof Eye; value: string }) {
  return (
    <span className="flex items-center gap-1.5 font-rajdhani font-medium">
      <Icon size={16} className="text-muted" />
      {value}
    </span>
  );
}

export function MangaCoverHero({ manga }: Props) {
  const firstChapter = manga.chapters[0];
  const latestChapter = manga.chapters[manga.chapters.length - 1];

  return (
    <div className="space-y-4">
      {/* ===== MOBILE LAYOUT (< lg) ===== */}
      <div className="lg:hidden flex flex-col items-center text-center space-y-4">
        {/* Cover */}
        <div className="relative w-48 h-72 rounded-lg overflow-hidden bg-elevated border border-default shadow-2xl shadow-black/50">
          {manga.cover && (
            <Image
              src={manga.cover}
              alt={manga.title}
              fill
              className="object-cover"
              sizes="192px"
              priority
            />
          )}
        </div>

        {/* Badges */}
        <div className="flex gap-1.5 flex-wrap justify-center">
          <Badge variant={statusVariant(manga.status)}>{manga.status}</Badge>
          <Badge variant="default">{manga.type}</Badge>
          {manga.year && <Badge variant="default">{manga.year}</Badge>}
          {manga.isHot && <Badge variant="accent">HOT</Badge>}
        </div>

        {/* Title */}
        <h1 className="font-rajdhani font-bold text-2xl text-primary leading-tight">
          {manga.title}
        </h1>

        {manga.altTitles?.length > 0 && (
          <p className="text-muted text-sm leading-relaxed line-clamp-2">
            {manga.altTitles.join(' / ')}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-secondary">
          <StatItem icon={Eye} value={formatCount(manga.views)} />
          <StatItem icon={Users} value={formatCount(manga.followersCount)} />
          <StatItem icon={BookOpen} value={`${manga.chaptersCount} ch.`} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {firstChapter && (
            <Link href={`/manga/${manga.slug}/${firstChapter.id}`}>
              <Button variant="primary" className="gap-2 font-rajdhani font-bold tracking-wide">
                <Play size={16} weight="fill" />
                Start Reading
              </Button>
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
        <div className="relative w-56 h-80 shrink-0 self-start rounded-lg overflow-hidden bg-elevated border border-default shadow-2xl shadow-black/50">
          {manga.cover && (
            <Image
              src={manga.cover}
              alt={manga.title}
              fill
              className="object-cover"
              sizes="224px"
              priority
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Badges */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <Badge variant={statusVariant(manga.status)}>{manga.status}</Badge>
            <Badge variant="default">{manga.type}</Badge>
            {manga.year && <Badge variant="default">{manga.year}</Badge>}
            {manga.isHot && <Badge variant="accent">HOT</Badge>}
          </div>

          {/* Title */}
          <h1 className="font-rajdhani font-bold text-4xl text-primary leading-tight">
            {manga.title}
          </h1>

          {/* Alt titles */}
          {manga.altTitles?.length > 0 && (
            <p className="text-muted text-sm line-clamp-2 leading-relaxed">
              {manga.altTitles.join(' / ')}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-5 text-sm text-secondary pt-1">
            <StatItem icon={Eye} value={`${formatCount(manga.views)} views`} />
            <StatItem icon={Users} value={`${formatCount(manga.followersCount)} followers`} />
            <StatItem icon={BookOpen} value={`${manga.chaptersCount} chapters`} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {firstChapter && (
              <Link href={`/manga/${manga.slug}/${firstChapter.id}`}>
                <Button variant="primary" className="gap-2 font-rajdhani font-bold tracking-wide">
                  <Play size={16} weight="fill" />
                  Start Reading
                </Button>
              </Link>
            )}
            <FollowButton mangaId={manga.id} followersCount={manga.followersCount} />
            <ReportButton mangaId={manga.id} firstChapterId={latestChapter?.id} />
          </div>

          {/* Description */}
          <MangaDescription description={manga.description} />
        </div>
      </div>
    </div>
  );
}
