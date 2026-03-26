'use client';
import { useState, useMemo, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  ListBulletsIcon,
  CaretDownIcon,
  CaretUpIcon,
  GlobeIcon,
} from '@phosphor-icons/react';
import { ChapterListItemRow } from './chapter-list-item';
import { Pagination } from '@/components/ui/pagination';
import type { ChapterListItem } from '@/types/manga.types';

interface Props {
  chapters: ChapterListItem[];
  mangaSlug: string;
}

type SortField = 'number' | 'date' | 'views';
type SortDir = 'asc' | 'desc';

const CHAPTERS_PER_PAGE = 50;

const LANG_LABELS: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  id: 'Indonesian',
  th: 'Thai',
};

function getLangLabel(code: string): string {
  return LANG_LABELS[code] ?? code.toUpperCase();
}

/**
 * Smart chapter search: typing "1" matches chapters whose number
 * starts with "1" (or equals "1"), not chapters like "10", "100".
 * Falls back to includes() for non-numeric queries.
 */
function matchChapter(chapterNumber: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const num = chapterNumber.trim().toLowerCase();

  // If query is purely numeric (e.g. "1", "12", "1.5"),
  // match chapters whose number equals or starts with query followed by a non-digit boundary
  if (/^[\d.]+$/.test(q)) {
    if (num === q) return true;
    // "1" should NOT match "10" but SHOULD match "1" or "1.5"
    // Check if num starts with q and the next char is a dot or end
    if (num.startsWith(q)) {
      const nextChar = num[q.length];
      // Allow match if next char is '.' (e.g. query "1" matches "1.5")
      // or if there's no next char (exact match, handled above)
      return nextChar === '.';
    }
    return false;
  }

  // Non-numeric query: use includes for flexibility
  return num.includes(q);
}

export function ChapterList({ chapters, mangaSlug }: Props) {
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [language, setLanguage] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Extract unique languages from chapters
  const languages = useMemo(() => {
    const set = new Set(chapters.map((ch) => ch.language));
    return Array.from(set).sort();
  }, [chapters]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let list = [...chapters];

    // Language filter
    if (language !== 'all') {
      list = list.filter((ch) => ch.language === language);
    }

    // Smart search
    if (query.trim()) {
      list = list.filter((ch) => matchChapter(ch.number, query));
    }

    list.sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1;
      switch (sortField) {
        case 'number':
          return (a.order - b.order) * dir;
        case 'date':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        case 'views':
          return (a.viewCount - b.viewCount) * dir;
        default:
          return 0;
      }
    });

    return list;
  }, [chapters, query, sortField, sortDir, language]);

  // Reset page when filters change
  const totalPages = Math.ceil(filtered.length / CHAPTERS_PER_PAGE);
  const safePage = Math.max(1, Math.min(page, totalPages || 1));

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const paginated = filtered.slice(
    (safePage - 1) * CHAPTERS_PER_PAGE,
    safePage * CHAPTERS_PER_PAGE,
  );

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? (
      <CaretDownIcon size={12} className="text-accent" />
    ) : (
      <CaretUpIcon size={12} className="text-accent" />
    );
  };

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <ListBulletsIcon size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
            Chapters
          </h2>
          <span className="text-xs text-muted">
            ({filtered.length})
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Language filter */}
          {languages.length > 1 && (
            <div className="relative">
              <GlobeIcon
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <select
                value={language}
                onChange={(e) => { setLanguage(e.target.value); setPage(1); }}
                className="appearance-none pl-7 pr-6 py-1.5 text-xs bg-elevated border border-default rounded-md text-primary focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
              >
                <option value="all">All Languages</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {getLangLabel(lang)}
                  </option>
                ))}
              </select>
              <CaretDownIcon
                size={10}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-50">
            <MagnifyingGlassIcon
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search chapter..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-elevated border border-default rounded-md text-primary placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center px-3 py-2 bg-elevated/60 border-b border-default text-xs text-muted select-none">
        <button
          onClick={() => handleSort('number')}
          aria-label="Sort by chapter number"
          className="flex items-center gap-1 hover:text-secondary transition-colors w-35 shrink-0"
        >
          Chapter <SortIcon field="number" />
        </button>
        <span className="flex-1" />
        <button
          onClick={() => handleSort('views')}
          aria-label="Sort by views"
          className="flex items-center gap-1 hover:text-secondary transition-colors w-17.5 justify-end shrink-0"
        >
          Views <SortIcon field="views" />
        </button>
        <button
          onClick={() => handleSort('date')}
          aria-label="Sort by date"
          className="flex items-center gap-1 hover:text-secondary transition-colors w-20 justify-end shrink-0"
        >
          Date <SortIcon field="date" />
        </button>
      </div>

      {/* Chapter rows */}
      <div className="max-h-150 overflow-y-auto chapter-list-scroll">
        {paginated.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">No chapters found.</p>
        ) : (
          paginated.map((chapter, index) => (
            <ChapterListItemRow
              key={chapter.id}
              chapter={chapter}
              mangaSlug={mangaSlug}
              striped={index % 2 === 1}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
