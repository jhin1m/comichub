import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
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
          <Badge variant="default">{genre.name}</Badge>
        </Link>
      ))}
    </div>
  );
}
