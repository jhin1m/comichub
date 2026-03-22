'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { mangaApi } from '@/lib/api/manga.api';
import type { MangaListItem, TaxonomyItem } from '@/types/manga.types';

interface Props {
  genres: TaxonomyItem[];
  currentMangaId: number;
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-[50px] h-[70px] rounded-sm bg-[#252525] shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-2.5 bg-[#252525] rounded w-1/3" />
            <div className="h-3 bg-[#252525] rounded w-full" />
            <div className="h-3 bg-[#252525] rounded w-4/5" />
            <div className="h-2.5 bg-[#252525] rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SimilarManga({ genres, currentMangaId }: Props) {
  const [items, setItems] = useState<MangaListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const firstGenreSlug = genres[0]?.slug;

  useEffect(() => {
    if (!firstGenreSlug) return;

    let cancelled = false;
    setLoading(true);

    mangaApi
      .similar(firstGenreSlug, currentMangaId, 6)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        // silently fail — sidebar is non-critical
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [firstGenreSlug, currentMangaId]);

  if (!genres.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[#f5f5f5] uppercase tracking-wider font-rajdhani">
        Recommendations
      </h3>

      {loading ? (
        <Skeleton />
      ) : items.length === 0 ? null : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/manga/${item.slug}`}
                className="flex gap-3 p-2 rounded-sm hover:bg-[#252525] transition-colors duration-150 group cursor-pointer"
              >
                {/* Cover thumbnail */}
                <div className="relative w-[50px] h-[70px] shrink-0 rounded-sm overflow-hidden bg-[#252525] border border-[#2a2a2a]">
                  {item.cover ? (
                    <Image
                      src={item.cover}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="50px"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#5a5a5a] text-[9px]">
                      No Cover
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-0.5 space-y-0.5">
                  <p className="text-[10px] font-medium text-[#707070] uppercase tracking-wide">
                    {item.type}
                  </p>
                  <p className="text-xs font-semibold text-[#f5f5f5] line-clamp-2 leading-snug group-hover:text-accent transition-colors duration-150">
                    {item.title}
                  </p>
                  <span className="flex items-center gap-1 text-[10px] text-[#a0a0a0]">
                    <Star size={10} className="text-yellow-400 fill-yellow-400 shrink-0" />
                    {Number(item.averageRating).toFixed(1)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
