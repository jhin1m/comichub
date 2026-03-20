import Link from 'next/link';
import { PixelBadge } from '@pxlkit/ui-kit';
import type { TaxonomyItem } from '@/types/manga.types';

interface Props {
  genres: TaxonomyItem[];
}

export function MangaGenres({ genres }: Props) {
  if (!genres.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((genre) => (
        <Link key={genre.id} href={`/browse?genre=${genre.slug}`}>
          <PixelBadge tone="neutral">{genre.name}</PixelBadge>
        </Link>
      ))}
    </div>
  );
}
