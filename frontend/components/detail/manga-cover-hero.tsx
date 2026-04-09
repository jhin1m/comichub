import Image from 'next/image';
import Link from 'next/link';
import { EyeIcon, UsersIcon, BookOpenIcon, StarIcon, ChatCircleIcon } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { FollowButton } from './follow-button';
import { ReportButton } from './report-button';
import { MangaDescription } from './manga-description';
import { MangaGenres } from './manga-genres';
import { ContinueReadingButton } from './continue-reading-button';

import { statusVariant, formatCount } from '@/lib/utils';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
  commentCount?: number;
}

function StatPill({ icon: Icon, value, label, accent }: { icon: typeof EyeIcon; value: string; label?: string; accent?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-elevated font-medium">
      <Icon size={13} className={accent ? 'text-warning' : 'text-muted'} />
      <span className={`font-rajdhani font-semibold ${accent ? 'text-warning' : 'text-primary'}`}>{value}</span>
      {label && <span className="text-secondary">{label}</span>}
    </span>
  );
}

export function MangaCoverHero({ manga, commentCount }: Props) {
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
          {(manga.contentRating === 'pornographic' || manga.contentRating === 'erotica') && (
            <Badge variant="accent">18+</Badge>
          )}
          {manga.contentRating === 'suggestive' && (
            <Badge variant="warning">Suggestive</Badge>
          )}
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

        {/* Genre pills */}
        <MangaGenres genres={manga.genres} />

        {/* Stats */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <StatPill icon={EyeIcon} value={formatCount(manga.views)} label="views" />
          <StatPill icon={UsersIcon} value={formatCount(manga.followersCount)} label="followers" />
          <StatPill icon={BookOpenIcon} value={String(manga.chaptersCount)} label="ch." />
          {Number(manga.averageRating) > 0 && (
            <StatPill icon={StarIcon} value={Number(manga.averageRating).toFixed(1)} accent />
          )}
          {commentCount != null && commentCount > 0 && (
            <StatPill icon={ChatCircleIcon} value={String(commentCount)} label="comments" />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <ContinueReadingButton mangaId={manga.id} mangaSlug={manga.slug} firstChapterId={firstChapter?.id} />
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
            {(manga.contentRating === 'pornographic' || manga.contentRating === 'erotica') && (
              <Badge variant="accent">18+</Badge>
            )}
            {manga.contentRating === 'suggestive' && (
              <Badge variant="warning">Suggestive</Badge>
            )}
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

          {/* Genre pills */}
          <MangaGenres genres={manga.genres} />

          {/* Stats */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <StatPill icon={EyeIcon} value={formatCount(manga.views)} label="views" />
            <StatPill icon={UsersIcon} value={formatCount(manga.followersCount)} label="followers" />
            <StatPill icon={BookOpenIcon} value={String(manga.chaptersCount)} label="chapters" />
            {Number(manga.averageRating) > 0 && (
              <StatPill icon={StarIcon} value={Number(manga.averageRating).toFixed(1)} accent />
            )}
            {commentCount != null && commentCount > 0 && (
              <StatPill icon={ChatCircleIcon} value={String(commentCount)} label="comments" />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <ContinueReadingButton mangaId={manga.id} mangaSlug={manga.slug} firstChapterId={firstChapter?.id} />
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
