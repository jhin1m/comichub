'use client';
import Image from 'next/image';
import Link from 'next/link';
import { PixelBadge } from '@pxlkit/ui-kit';
import { statusTone } from '@/lib/utils';
import type { MangaListItem } from '@/types/manga.types';

export function MangaCard({ manga }: { manga: MangaListItem }) {
  return (
    <Link href={`/manga/${manga.slug}`} className="group block">
      <div className="relative aspect-[2/3] rounded-[4px] overflow-hidden bg-surface border border-[#2a2a2a] transition-transform duration-150 ease-out group-hover:-translate-y-1 group-hover:border-accent">
        {manga.cover ? (
          <Image
            src={manga.cover}
            alt={manga.title}
            fill
            className="object-cover"
            sizes="(max-width:480px) 50vw,(max-width:768px) 33vw,200px"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#5a5a5a] text-sm">
            No Cover
          </div>
        )}
        <div className="absolute top-2 left-2">
          <PixelBadge tone={statusTone(manga.status)}>
            {manga.status}
          </PixelBadge>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <p className="text-sm font-semibold text-[#f5f5f5] line-clamp-2 leading-tight">
          {manga.title}
        </p>
        <p className="text-xs text-[#a0a0a0]">{manga.chaptersCount} ch</p>
      </div>
    </Link>
  );
}
