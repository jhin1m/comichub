'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { genreApi } from '@/lib/api/genre.api';
import { artistApi } from '@/lib/api/artist.api';
import { authorApi } from '@/lib/api/author.api';
import { mangaApi } from '@/lib/api/manga.api';
import { FilterDropdown } from '@/components/browse/filter-dropdown';
import { GenreFilter } from '@/components/browse/genre-filter';
import { SearchableSelect } from '@/components/browse/searchable-select';
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

const RATING_OPTIONS = [
  { value: '3', label: '3+ Stars' },
  { value: '3.5', label: '3.5+ Stars' },
  { value: '4', label: '4+ Stars' },
  { value: '4.5', label: '4.5+ Stars' },
];

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= 1990; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
})();

interface AdvancedFilterBarProps {
  currentParams: MangaQueryParams;
  onApplyFilters: (updates: Record<string, string | null>) => void;
  isOpen: boolean;
}

export function AdvancedFilterBar({ currentParams, onApplyFilters, isOpen }: AdvancedFilterBarProps) {
  const [genres, setGenres] = useState<TaxonomyItem[]>([]);
  const [artists, setArtists] = useState<TaxonomyItem[]>([]);
  const [authors, setAuthors] = useState<TaxonomyItem[]>([]);
  const [includeGenres, setIncludeGenres] = useState<string[]>([]);
  const [excludeGenres, setExcludeGenres] = useState<string[]>([]);
  const [localFilters, setLocalFilters] = useState<Record<string, string>>({});

  // Sync local filters from URL params
  useEffect(() => {
    const filters: Record<string, string> = {};
    if (currentParams.sort) filters.sort = currentParams.sort;
    if (currentParams.type) filters.type = currentParams.type;
    if (currentParams.status) filters.status = currentParams.status;
    if (currentParams.artist) filters.artist = String(currentParams.artist);
    if (currentParams.author) filters.author = String(currentParams.author);
    if (currentParams.demographic) filters.demographic = currentParams.demographic;
    if (currentParams.yearFrom) filters.yearFrom = String(currentParams.yearFrom);
    if (currentParams.yearTo) filters.yearTo = String(currentParams.yearTo);
    if (currentParams.minChapter) filters.minChapter = String(currentParams.minChapter);
    if (currentParams.minRating) filters.minRating = String(currentParams.minRating);
    if (currentParams.nsfw) filters.nsfw = 'true';
    setLocalFilters(filters);
  }, [
    currentParams.sort, currentParams.type, currentParams.status,
    currentParams.artist, currentParams.author, currentParams.demographic,
    currentParams.yearFrom, currentParams.yearTo, currentParams.minChapter,
    currentParams.minRating, currentParams.nsfw,
  ]);

  // Sync genre arrays from URL params
  useEffect(() => {
    setIncludeGenres(currentParams.includeGenres ? currentParams.includeGenres.split(',') : []);
    setExcludeGenres(currentParams.excludeGenres ? currentParams.excludeGenres.split(',') : []);
  }, [currentParams.includeGenres, currentParams.excludeGenres]);

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
    onApplyFilters({
      sort: localFilters.sort || null,
      type: localFilters.type || null,
      genre: null,
      includeGenres: includeGenres.length ? includeGenres.join(',') : null,
      excludeGenres: excludeGenres.length ? excludeGenres.join(',') : null,
      status: localFilters.status || null,
      artist: localFilters.artist || null,
      author: localFilters.author || null,
      demographic: localFilters.demographic || null,
      minChapter: localFilters.minChapter || null,
      yearFrom: localFilters.yearFrom || null,
      yearTo: localFilters.yearTo || null,
      minRating: localFilters.minRating || null,
      nsfw: localFilters.nsfw || null,
    });
  }, [localFilters, includeGenres, excludeGenres, onApplyFilters]);

  const handleReset = useCallback(() => {
    setLocalFilters({});
    setIncludeGenres([]);
    setExcludeGenres([]);
    onApplyFilters({
      sort: null, type: null, genre: null, status: null,
      artist: null, author: null, demographic: null,
      minChapter: null, yearFrom: null, yearTo: null,
      includeGenres: null, excludeGenres: null,
      minRating: null, nsfw: null,
    });
  }, [onApplyFilters]);

  const router = useRouter();
  const [isRandomLoading, setIsRandomLoading] = useState(false);

  const handleFeelLucky = useCallback(async () => {
    setIsRandomLoading(true);
    try {
      const { slug } = await mangaApi.random();
      router.push(`/manga/${slug}`);
    } catch {
      // fallback: do nothing if API fails
    } finally {
      setIsRandomLoading(false);
    }
  }, [router]);

  const artistOptions = artists.map((a) => ({ value: String(a.id), label: a.name }));
  const authorOptions = authors.map((a) => ({ value: String(a.id), label: a.name }));

  if (!isOpen) return null;

  return (
    <div className="bg-surface border border-default rounded p-5 space-y-4">
      {/* Row 1: 6-col aligned — Sort, Types, Genres, Demographic, Status, Min Chapter */}
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
        <GenreFilter
          genres={genres}
          includeGenres={includeGenres}
          excludeGenres={excludeGenres}
          onIncludeChange={setIncludeGenres}
          onExcludeChange={setExcludeGenres}
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
        <FilterDropdown
          label="Min Chapter"
          value={localFilters.minChapter || ''}
          options={[
            { value: '1', label: '1+' },
            { value: '10', label: '10+' },
            { value: '50', label: '50+' },
            { value: '100', label: '100+' },
            { value: '200', label: '200+' },
            { value: '500', label: '500+' },
          ]}
          onChange={(v) => setFilter('minChapter', v)}
          placeholder="Any"
        />
      </div>

      {/* Row 2: 6-col aligned — Year From, Year To, Authors, Artists, Rating, NSFW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <FilterDropdown
          label="Year From"
          value={localFilters.yearFrom || ''}
          options={YEAR_OPTIONS}
          onChange={(v) => setFilter('yearFrom', v)}
          placeholder="From"
        />
        <FilterDropdown
          label="Year To"
          value={localFilters.yearTo || ''}
          options={YEAR_OPTIONS}
          onChange={(v) => setFilter('yearTo', v)}
          placeholder="To"
        />
        <SearchableSelect
          label="Authors"
          value={localFilters.author || ''}
          options={authorOptions}
          onChange={(v) => setFilter('author', v)}
          placeholder="Search authors..."
        />
        <SearchableSelect
          label="Artists"
          value={localFilters.artist || ''}
          options={artistOptions}
          onChange={(v) => setFilter('artist', v)}
          placeholder="Search artists..."
        />
        <FilterDropdown
          label="Min Rating"
          value={localFilters.minRating || ''}
          options={RATING_OPTIONS}
          onChange={(v) => setFilter('minRating', v)}
          placeholder="Any"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-secondary uppercase tracking-[0.08em]">
            NSFW
          </span>
          <label className="flex items-center gap-2 px-3 py-2 bg-hover border border-hover rounded cursor-pointer">
            <input
              type="checkbox"
              checked={localFilters.nsfw === 'true'}
              onChange={(e) => setFilter('nsfw', e.target.checked ? 'true' : '')}
              className="accent-accent"
            />
            <span className="text-sm text-secondary">Include</span>
          </label>
        </div>
      </div>

      {/* Row 3: Action buttons — right-aligned */}
      <div className="flex items-center justify-end gap-3">
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
          disabled={isRandomLoading}
          className="px-4 py-2 border border-hover rounded text-xs font-semibold uppercase tracking-wider text-secondary hover:border-muted hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
        >
          {isRandomLoading ? 'Loading...' : "I'm Feeling Lucky"}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="px-6 py-2 bg-accent hover:bg-accent-hover rounded text-xs font-semibold uppercase tracking-wider text-white transition-colors cursor-pointer"
        >
          Apply Filter
        </button>
      </div>
    </div>
  );
}
