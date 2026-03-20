import Image from 'next/image';
import Link from 'next/link';
import { PixelButton, PixelBadge } from '@pxlkit/ui-kit';
import type { MangaListItem } from '@/types/manga.types';

export function HeroBanner({ featured }: { featured: MangaListItem }) {
  return (
    <div className="relative h-[260px] md:h-[480px] overflow-hidden">
      {featured.cover && (
        <Image
          src={featured.cover}
          alt=""
          fill
          className="object-cover blur-sm scale-110 opacity-60"
          priority
        />
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.9) 40%, transparent)' }}
      />
      <div className="absolute bottom-8 left-0 right-0 px-4 md:px-8 max-w-[1400px] mx-auto">
        <div className="mb-2">
          <PixelBadge tone="red">HOT</PixelBadge>
        </div>
        <h1 className="font-rajdhani font-bold text-3xl md:text-5xl text-white mb-2 max-w-xl">
          {featured.title}
        </h1>
        <p className="text-[#a0a0a0] text-sm mb-4">{featured.chaptersCount} Chapters</p>
        <Link href={`/manga/${featured.slug}`}>
          <PixelButton tone="red">
            Start Reading
          </PixelButton>
        </Link>
      </div>
    </div>
  );
}
