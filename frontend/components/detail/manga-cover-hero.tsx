import Image from 'next/image';
import Link from 'next/link';
import { PixelBadge, PixelButton } from '@pxlkit/ui-kit';
import { FollowButton } from './follow-button';
import { MangaStats } from './manga-stats';
import { statusTone } from '@/lib/utils';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

export function MangaCoverHero({ manga }: Props) {
  const latestChapter = manga.chapters[0];

  return (
    <div className="bg-surface border-b border-[#2a2a2a]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex gap-6 md:gap-8">
          {/* Cover image */}
          <div className="relative w-[140px] md:w-[200px] shrink-0 aspect-[2/3] rounded-[4px] overflow-hidden bg-elevated border border-[#2a2a2a]">
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

          {/* Meta */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <PixelBadge tone={statusTone(manga.status)}>{manga.status}</PixelBadge>
              <PixelBadge tone="neutral">{manga.type}</PixelBadge>
            </div>

            <h1 className="font-rajdhani font-bold text-2xl md:text-4xl text-[#f5f5f5] leading-tight">
              {manga.title}
            </h1>

            {manga.titleAlt && (
              <p className="text-[#a0a0a0] text-sm">{manga.titleAlt}</p>
            )}

            <MangaStats manga={manga} />

            <div className="flex gap-3 flex-wrap pt-2">
              {latestChapter && (
                <Link href={`/manga/${manga.slug}/${latestChapter.id}`}>
                  <PixelButton tone="red">
                    Read Chapter {latestChapter.number}
                  </PixelButton>
                </Link>
              )}
              <FollowButton mangaId={manga.id} followersCount={manga.followersCount} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
