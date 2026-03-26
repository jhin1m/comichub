'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { StarIcon, BooksIcon, SparkleIcon } from '@phosphor-icons/react';
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
          <div className="w-[50px] h-[70px] rounded-sm bg-elevated shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-2.5 bg-elevated rounded w-1/3" />
            <div className="h-3 bg-elevated rounded w-full" />
            <div className="h-3 bg-elevated rounded w-4/5" />
            <div className="h-2.5 bg-elevated rounded w-1/4" />
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
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary uppercase tracking-wider font-rajdhani">
        <SparkleIcon size={16} weight="fill" className="text-accent" />
        Recommendations
      </h3>

      {loading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BooksIcon size={48} className="text-muted mb-4" />
          <p className="text-secondary text-sm mb-2">No recommendations found</p>
          <p className="text-muted text-xs">Try again later</p>
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/manga/${item.slug}`}
                className="flex gap-3 p-2 rounded-sm hover:bg-elevated transition-colors duration-150 group cursor-pointer"
              >
                {/* Cover thumbnail */}
                <div className="relative w-[50px] h-[70px] shrink-0 rounded-sm overflow-hidden bg-elevated border border-default">
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
                    <div className="w-full h-full flex items-center justify-center text-muted text-[9px]">
                      No Cover
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-0.5 space-y-0.5">
                  <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    {item.type}
                  </p>
                  <p className="text-xs font-semibold text-primary line-clamp-2 leading-snug group-hover:text-accent transition-colors duration-150">
                    {item.title}
                  </p>
                  <span className="flex items-center gap-1 text-[10px] text-secondary">
                    <StarIcon size={10} weight="fill" className="text-warning shrink-0" />
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
