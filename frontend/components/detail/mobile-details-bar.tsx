'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import StarRating from './star-rating';
import { MangaMetadata } from './manga-metadata';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

/** Mobile-only: rating bar with collapsible metadata dropdown */
export function MobileDetailsBar({ manga }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Bar: rating left, details button right */}
      <div className="flex items-center justify-between bg-surface rounded-lg px-4 py-3">
        <StarRating
          mangaId={manga.id}
          averageRating={manga.averageRating}
          totalRatings={manga.totalRatings}
        />
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors cursor-pointer"
          aria-expanded={open}
          aria-label="Toggle manga details"
        >
          Details
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Collapsible metadata */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'
        }`}
      >
        <MangaMetadata manga={manga} />
      </div>
    </div>
  );
}
