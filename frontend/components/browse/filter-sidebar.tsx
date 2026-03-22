'use client';
import { useEffect, useState } from 'react';
import { genreApi } from '@/lib/api/genre.api';
import type { TaxonomyItem, MangaQueryParams, MangaStatus, MangaType } from '@/types/manga.types';

const STATUSES: { value: MangaStatus; label: string }[] = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'dropped', label: 'Dropped' },
];

const TYPES: { value: MangaType; label: string }[] = [
  { value: 'manga', label: 'Manga' },
  { value: 'manhwa', label: 'Manhwa' },
  { value: 'manhua', label: 'Manhua' },
  { value: 'doujinshi', label: 'Doujinshi' },
];

interface FilterSidebarProps {
  currentParams: MangaQueryParams;
  onFilter: (updates: Record<string, string | null>) => void;
}

export function FilterSidebar({ currentParams, onFilter }: FilterSidebarProps) {
  const [genres, setGenres] = useState<TaxonomyItem[]>([]);

  useEffect(() => {
    genreApi.list().then(setGenres).catch(() => {});
  }, []);

  return (
    <aside className="w-60 shrink-0 hidden md:block space-y-6">
      {/* Genre */}
      <div>
        <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
          Genre
        </h3>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {genres.map((genre) => (
            <label key={genre.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="genre"
                className="accent-accent"
                checked={currentParams.genre === genre.slug}
                onChange={() => onFilter({ genre: genre.slug })}
              />
              <span className="text-sm text-secondary group-hover:text-primary transition-colors">
                {genre.name}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="genre"
              className="accent-accent"
              checked={!currentParams.genre}
              onChange={() => onFilter({ genre: null })}
            />
            <span className="text-sm text-secondary group-hover:text-primary transition-colors">
              All
            </span>
          </label>
        </div>
      </div>

      {/* Status */}
      <div>
        <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
          Status
        </h3>
        <div className="space-y-1.5">
          {STATUSES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="status"
                className="accent-accent"
                checked={currentParams.status === s.value}
                onChange={() => onFilter({ status: s.value })}
              />
              <span className="text-sm text-secondary group-hover:text-primary transition-colors">
                {s.label}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="status"
              className="accent-accent"
              checked={!currentParams.status}
              onChange={() => onFilter({ status: null })}
            />
            <span className="text-sm text-secondary group-hover:text-primary transition-colors">
              All
            </span>
          </label>
        </div>
      </div>

      {/* Type */}
      <div>
        <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3">
          Type
        </h3>
        <div className="space-y-1.5">
          {TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="type"
                className="accent-accent"
                checked={currentParams.type === t.value}
                onChange={() => onFilter({ type: t.value })}
              />
              <span className="text-sm text-secondary group-hover:text-primary transition-colors">
                {t.label}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="type"
              className="accent-accent"
              checked={!currentParams.type}
              onChange={() => onFilter({ type: null })}
            />
            <span className="text-sm text-secondary group-hover:text-primary transition-colors">
              All
            </span>
          </label>
        </div>
      </div>
    </aside>
  );
}
