import Image from 'next/image';
import Link from 'next/link';
import { formatRelativeDate } from '@/lib/utils';
import type { MangaListItem } from '@/types/manga.types';

export function LatestUpdatesStrip({ items }: { items: MangaListItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((manga) => (
        <Link
          key={manga.id}
          href={`/manga/${manga.slug}`}
          className="flex gap-3 p-2 rounded-[4px] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#1a1a1a] transition-colors group"
        >
          <div className="relative w-12 h-16 flex-shrink-0 rounded-[2px] overflow-hidden bg-[#1a1a1a]">
            {manga.cover ? (
              <Image
                src={manga.cover}
                alt={manga.title}
                fill
                className="object-cover"
                sizes="48px"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#5a5a5a] text-[10px]">
                N/A
              </div>
            )}
          </div>
          <div className="flex flex-col justify-between min-w-0 py-0.5">
            <p className="text-sm font-semibold text-[#f5f5f5] line-clamp-1 leading-tight group-hover:text-[#e63946] transition-colors">
              {manga.title}
            </p>
            <p className="text-xs text-[#a0a0a0]">
              {manga.chaptersCount > 0 ? `Ch. ${manga.chaptersCount}` : 'No chapters'}
            </p>
            <p className="text-xs text-[#5a5a5a]">{formatRelativeDate(manga.updatedAt)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
