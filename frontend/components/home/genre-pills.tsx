import Link from 'next/link';
import type { TaxonomyItem } from '@/types/manga.types';

export function GenrePills({ genres }: { genres: TaxonomyItem[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {genres.map((genre) => (
        <Link
          key={genre.id}
          href={`/browse?genre=${genre.slug}`}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border border-[#2a2a2a] text-[#a0a0a0] hover:border-[#e63946] hover:text-[#e63946] transition-colors whitespace-nowrap"
        >
          {genre.name}
        </Link>
      ))}
    </div>
  );
}
