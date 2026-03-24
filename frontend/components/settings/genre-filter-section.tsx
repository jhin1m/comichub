'use client';

import { Star } from '@phosphor-icons/react';
import type { ContentPreferences } from '@/types/preferences.types';
import type { TaxonomyItem } from '@/types/manga.types';

interface GenreFilterSectionProps {
  genres: TaxonomyItem[];
  excludedGenreSlugs: string[];
  highlightedGenreSlugs: string[];
  onChange: (partial: Partial<ContentPreferences>) => void;
}

export function GenreFilterSection({
  genres,
  excludedGenreSlugs,
  highlightedGenreSlugs,
  onChange,
}: GenreFilterSectionProps) {
  function toggleExclude(slug: string) {
    const next = excludedGenreSlugs.includes(slug)
      ? excludedGenreSlugs.filter((g) => g !== slug)
      : [...excludedGenreSlugs, slug];
    onChange({ excludedGenreSlugs: next });
  }

  function toggleHighlight(slug: string) {
    const next = highlightedGenreSlugs.includes(slug)
      ? highlightedGenreSlugs.filter((g) => g !== slug)
      : [...highlightedGenreSlugs, slug];
    onChange({ highlightedGenreSlugs: next });
  }

  if (genres.length === 0) {
    return (
      <section className="bg-surface border border-default rounded-lg p-6">
        <h2 className="font-heading text-primary text-xl mb-1">Genres</h2>
        <p className="text-secondary text-sm">Loading genres...</p>
      </section>
    );
  }

  return (
    <section className="bg-surface border border-default rounded-lg p-6">
      <h2 className="font-heading text-primary text-xl mb-1">Genres</h2>
      <p className="text-secondary text-sm mb-4">
        Check to exclude &middot; Click star to highlight
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {genres.map((genre) => {
          const isExcluded = excludedGenreSlugs.includes(genre.slug);
          const isHighlighted = highlightedGenreSlugs.includes(genre.slug);
          return (
            <div
              key={genre.id}
              className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-elevated transition-colors"
            >
              <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                <input
                  type="checkbox"
                  checked={isExcluded}
                  onChange={() => toggleExclude(genre.slug)}
                  className="w-4 h-4 accent-red-500 cursor-pointer shrink-0"
                />
                <span
                  className={`text-sm truncate ${
                    isExcluded ? 'text-red-400 line-through' : 'text-primary'
                  }`}
                >
                  {genre.name}
                </span>
              </label>
              <button
                type="button"
                onClick={() => toggleHighlight(genre.slug)}
                className="shrink-0 p-0.5 rounded transition-colors hover:text-accent"
                aria-label={isHighlighted ? `Remove ${genre.name} highlight` : `Highlight ${genre.name}`}
              >
                <Star
                  size={16}
                  weight={isHighlighted ? 'fill' : 'regular'}
                  className={isHighlighted ? 'text-accent' : 'text-secondary'}
                />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
