'use client';
import { useState, useEffect, useCallback } from 'react';
import { genreApi } from '@/lib/api/genre.api';
import { artistApi } from '@/lib/api/artist.api';
import { authorApi } from '@/lib/api/author.api';
import { FilterDropdown } from '@/components/browse/filter-dropdown';
import type { TaxonomyItem, MangaQueryParams } from '@/types/manga.types';

const SORT_OPTIONS = [
  { value: 'updated_at', label: 'Latest Update' },
  { value: 'created_at', label: 'Newest' },
  { value: 'views', label: 'Most Views' },
];

const TYPE_OPTIONS = [
  { value: 'manga', label: 'Manga' },
  { value: 'manhwa', label: 'Manhwa' },
  { value: 'manhua', label: 'Manhua' },
  { value: 'doujinshi', label: 'Doujinshi' },
];

const DEMOGRAPHIC_OPTIONS = [
  { value: 'shounen', label: 'Shounen' },
  { value: 'shoujo', label: 'Shoujo' },
  { value: 'seinen', label: 'Seinen' },
  { value: 'josei', label: 'Josei' },
];

const STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'hiatus', label: 'Hiatus' },
  { value: 'dropped', label: 'Dropped' },
];

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= 1990; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
})();

const MIN_CHAPTER_OPTIONS = [
  { value: '1', label: '1+' },
  { value: '10', label: '10+' },
  { value: '20', label: '20+' },
  { value: '50', label: '50+' },
  { value: '100', label: '100+' },
  { value: '200', label: '200+' },
  { value: '500', label: '500+' },
];

interface AdvancedFilterBarProps {
  currentParams: MangaQueryParams;
  onApplyFilters: (updates: Record<string, string | null>) => void;
  isOpen: boolean;
}

export function AdvancedFilterBar({ currentParams, onApplyFilters, isOpen }: AdvancedFilterBarProps) {
  const [genres, setGenres] = useState<TaxonomyItem[]>([]);
  const [artists, setArtists] = useState<TaxonomyItem[]>([]);
  const [authors, setAuthors] = useState<TaxonomyItem[]>([]);

  // Local filter state (applied on "Apply Filter" click)
  const [localFilters, setLocalFilters] = useState<Record<string, string>>({});

  // Sync local filters from URL params when they change
  useEffect(() => {
    const filters: Record<string, string> = {};
    if (currentParams.sort) filters.sort = currentParams.sort;
    if (currentParams.type) filters.type = currentParams.type;
    if (currentParams.genre) filters.genre = currentParams.genre;
    if (currentParams.status) filters.status = currentParams.status;
    if (currentParams.artist) filters.artist = String(currentParams.artist);
    if (currentParams.author) filters.author = String(currentParams.author);
    setLocalFilters(filters);
  }, [currentParams.sort, currentParams.type, currentParams.genre, currentParams.status, currentParams.artist, currentParams.author]);

  useEffect(() => {
    genreApi.list().then(setGenres).catch(() => {});
  }, []);

  // Lazy-load artists/authors when panel opens
  useEffect(() => {
    if (!isOpen) return;
    if (artists.length === 0) artistApi.list().then(setArtists).catch(() => {});
    if (authors.length === 0) authorApi.list().then(setAuthors).catch(() => {});
  }, [isOpen, artists.length, authors.length]);

  const setFilter = useCallback((key: string, value: string) => {
    setLocalFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const handleApply = useCallback(() => {
    const updates: Record<string, string | null> = {
      sort: localFilters.sort || null,
      type: localFilters.type || null,
      genre: localFilters.genre || null,
      status: localFilters.status || null,
      artist: localFilters.artist || null,
      author: localFilters.author || null,
      // These are UI-only for now (BE not supported yet)
      demographic: localFilters.demographic || null,
      minChapter: localFilters.minChapter || null,
      yearFrom: localFilters.yearFrom || null,
      yearTo: localFilters.yearTo || null,
    };
    onApplyFilters(updates);
  }, [localFilters, onApplyFilters]);

  const handleReset = useCallback(() => {
    setLocalFilters({});
    onApplyFilters({
      sort: null, type: null, genre: null, status: null,
      artist: null, author: null, demographic: null,
      minChapter: null, yearFrom: null, yearTo: null,
    });
  }, [onApplyFilters]);

  const handleFeelLucky = useCallback(() => {
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];
    const randomType = TYPE_OPTIONS[Math.floor(Math.random() * TYPE_OPTIONS.length)];
    const updates: Record<string, string | null> = {
      sort: null, type: randomType.value, status: null,
      artist: null, author: null, demographic: null,
      minChapter: null, yearFrom: null, yearTo: null,
      genre: randomGenre?.slug || null,
    };
    setLocalFilters({
      type: randomType.value,
      ...(randomGenre ? { genre: randomGenre.slug } : {}),
    });
    onApplyFilters(updates);
  }, [genres, onApplyFilters]);

  const genreOptions = genres.map((g) => ({ value: g.slug, label: g.name }));
  const artistOptions = artists.map((a) => ({ value: String(a.id), label: a.name }));
  const authorOptions = authors.map((a) => ({ value: String(a.id), label: a.name }));

  const hasActiveFilters = Object.keys(localFilters).length > 0;

  if (!isOpen) return null;

  return (
    <div>
        <div className="bg-surface border border-default rounded p-5 space-y-5">
          {/* Row 1: Sort, Types, Genres, Demographic, Release Status, Min Chapter */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <FilterDropdown
              label="Sort By"
              value={localFilters.sort || ''}
              options={SORT_OPTIONS}
              onChange={(v) => setFilter('sort', v)}
              placeholder="Any"
            />
            <FilterDropdown
              label="Types"
              value={localFilters.type || ''}
              options={TYPE_OPTIONS}
              onChange={(v) => setFilter('type', v)}
              placeholder="Any"
            />
            <FilterDropdown
              label="Genres"
              value={localFilters.genre || ''}
              options={genreOptions}
              onChange={(v) => setFilter('genre', v)}
              placeholder="Any"
              searchable
            />
            <FilterDropdown
              label="Demographic"
              value={localFilters.demographic || ''}
              options={DEMOGRAPHIC_OPTIONS}
              onChange={(v) => setFilter('demographic', v)}
              placeholder="Any"
            />
            <FilterDropdown
              label="Release Status"
              value={localFilters.status || ''}
              options={STATUS_OPTIONS}
              onChange={(v) => setFilter('status', v)}
              placeholder="Any"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-secondary uppercase tracking-[0.08em]">
                Minimum Chapter
              </span>
              <input
                type="number"
                min={0}
                value={localFilters.minChapter || ''}
                onChange={(e) => setFilter('minChapter', e.target.value)}
                placeholder="Any"
                className="w-full px-3 py-2 bg-hover border border-hover rounded text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Row 2: Release Year, Authors, Artists + Action buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            {/* Release Year From/To */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold text-secondary uppercase tracking-[0.08em]">
                Release Year
              </span>
              <div className="flex gap-2">
                <FilterDropdown
                  label=""
                  value={localFilters.yearFrom || ''}
                  options={YEAR_OPTIONS}
                  onChange={(v) => setFilter('yearFrom', v)}
                  placeholder="From"
                />
                <FilterDropdown
                  label=""
                  value={localFilters.yearTo || ''}
                  options={YEAR_OPTIONS}
                  onChange={(v) => setFilter('yearTo', v)}
                  placeholder="To"
                />
              </div>
            </div>

            <FilterDropdown
              label="Authors"
              value={localFilters.author || ''}
              options={authorOptions}
              onChange={(v) => setFilter('author', v)}
              placeholder="Any"
              searchable
            />
            <FilterDropdown
              label="Artists"
              value={localFilters.artist || ''}
              options={artistOptions}
              onChange={(v) => setFilter('artist', v)}
              placeholder="Any"
              searchable
            />

            {/* Action buttons */}
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-hover rounded text-xs font-semibold uppercase tracking-wider text-secondary hover:border-muted hover:text-primary transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={handleFeelLucky}
              className="px-4 py-2 border border-hover rounded text-xs font-semibold uppercase tracking-wider text-secondary hover:border-muted hover:text-primary transition-colors cursor-pointer"
            >
              I&apos;m Feeling Lucky
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 bg-accent hover:bg-accent-hover rounded text-xs font-semibold uppercase tracking-wider text-white transition-colors cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
    </div>
  );
}
