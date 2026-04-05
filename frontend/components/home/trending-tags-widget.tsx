import Link from 'next/link';
import { TrendUpIcon } from '@phosphor-icons/react/ssr';
import type { TaxonomyItem } from '@/types/manga.types';

interface Props {
  genres: TaxonomyItem[];
}

export function TrendingTagsWidget({ genres }: Props) {
  if (genres.length === 0) return null;

  // Show first 10 genres as "trending"
  const tags = genres.slice(0, 10);

  return (
    <div className="mt-6 pt-4 border-t border-default">
      <h3 className="font-rajdhani font-bold text-lg text-primary mb-3 flex items-center gap-1.5">
        <TrendUpIcon size={16} className="text-accent" />
        Trending Tags
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((genre) => (
          <Link
            key={genre.id}
            href={`/browse?genre=${genre.slug}`}
            className="text-[11px] px-2.5 py-1.5 rounded bg-elevated border border-default text-secondary hover:border-accent hover:text-accent transition-colors"
          >
            {genre.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
