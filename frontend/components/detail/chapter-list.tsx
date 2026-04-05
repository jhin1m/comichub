'use client';
import { useState, useMemo, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  ListBulletsIcon,
  CaretDownIcon,
  CaretUpIcon,
  GlobeIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { ChapterListItemRow } from './chapter-list-item';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/contexts/auth.context';
import { userApi } from '@/lib/api/user.api';
import type { ChapterListItem } from '@/types/manga.types';

interface Props {
  chapters: ChapterListItem[];
  mangaSlug: string;
  mangaId: number;
}

type SortField = 'number' | 'date';
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

export function ChapterList({ chapters, mangaSlug, mangaId }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [language, setLanguage] = useState<string>('all');
  const [group, setGroup] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [lastReadChapterId, setLastReadChapterId] = useState<number | null>(null);

  // Fetch last-read chapter for logged-in users
  const userId = user?.id;
  useEffect(() => {
    if (!userId) { setLastReadChapterId(null); return; }
    let cancelled = false;
    userApi.getLastRead(mangaId)
      .then((entry) => { if (!cancelled) setLastReadChapterId(entry?.chapterId ?? null); })
      .catch(() => { if (!cancelled) setLastReadChapterId(null); });
    return () => { cancelled = true; };
  }, [userId, mangaId]);

  const handleBookmark = (chapterId: number) => {
    if (!user) return;
    setLastReadChapterId(chapterId);
    userApi.upsertHistory(mangaId, chapterId).catch(() => {});
  };

  // Extract unique languages from chapters
  const languages = useMemo(() => {
    const set = new Set(chapters.map((ch) => ch.language));
    return Array.from(set).sort();
  }, [chapters]);

  // Extract unique groups from chapters
  const uniqueGroups = useMemo(() => {
    const map = new Map<number, { id: number; name: string; slug: string }>();
    for (const ch of chapters) {
      for (const g of ch.groups ?? []) {
        if (!map.has(g.id)) map.set(g.id, g);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
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

    // Group filter
    if (group !== 'all') {
      const gid = Number(group);
      list = list.filter((ch) => ch.groups?.some((g) => g.id === gid));
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
        default:
          return 0;
      }
    });

    return list;
  }, [chapters, query, sortField, sortDir, language, group]);


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
    const isActive = sortField === field;
    const icon = isActive && sortDir === 'asc' ? 'up' : 'down';
    const cls = isActive ? 'text-accent' : 'text-muted/40';
    return icon === 'down' ? (
      <CaretDownIcon size={14} className={cls} />
    ) : (
      <CaretUpIcon size={14} className={cls} />
    );
  };

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5">
          <ListBulletsIcon size={20} className="text-accent" />
          <h2 className="font-semibold text-primary uppercase tracking-wider font-rajdhani">
            Chapters
          </h2>
          <span className="text-sm text-muted">
            ({filtered.length})
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Language filter */}
          {languages.length > 1 && (
            <div className="relative">
              <GlobeIcon
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <select
                value={language}
                onChange={(e) => { setLanguage(e.target.value); setPage(1); }}
                className="appearance-none pl-8 pr-7 py-2 text-sm bg-elevated border border-default rounded-lg text-primary focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
              >
                <option value="all">All Languages</option>
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {getLangLabel(lang)}
                  </option>
                ))}
              </select>
              <CaretDownIcon
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
            </div>
          )}

          {/* Group filter */}
          {uniqueGroups.length > 1 && (
            <div className="relative">
              <UsersThreeIcon
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <select
                value={group}
                onChange={(e) => { setGroup(e.target.value); setPage(1); }}
                className="appearance-none pl-8 pr-7 py-2 text-sm bg-elevated border border-default rounded-lg text-primary focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
              >
                <option value="all">All Groups</option>
                {uniqueGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <CaretDownIcon
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <MagnifyingGlassIcon
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search chapter..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-3 py-2 text-sm bg-elevated border border-default rounded-lg text-primary placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center px-4 py-2.5 bg-elevated/60 border-b border-default text-sm text-muted select-none">
        <button
          onClick={() => handleSort('number')}
          aria-label="Sort by chapter number"
          className="flex items-center gap-1.5 hover:text-secondary transition-colors w-40 shrink-0"
        >
          Chapter <SortIcon field="number" />
        </button>
        <span className="flex-1" />
        <span className="w-20 text-right shrink-0 hidden sm:block">Views</span>
        <button
          onClick={() => handleSort('date')}
          aria-label="Sort by date"
          className="flex items-center gap-1.5 hover:text-secondary transition-colors w-24 justify-end shrink-0"
        >
          Date <SortIcon field="date" />
        </button>
      </div>

      {/* Chapter rows */}
      <div className="max-h-200 overflow-y-auto overflow-x-hidden chapter-list-scroll">
        {paginated.length === 0 ? (
          <p className="text-base text-muted py-10 text-center">No chapters found.</p>
        ) : (
          (() => {
            // Compute once outside loop — avoids O(n*m) on every render
            const lastReadOrder = lastReadChapterId
              ? chapters.find((c) => c.id === lastReadChapterId)?.order ?? -1
              : -1;

            return paginated.map((chapter, index) => (
              <ChapterListItemRow
                key={chapter.id}
                chapter={chapter}
                mangaSlug={mangaSlug}
                striped={index % 2 === 1}
                isLastRead={chapter.id === lastReadChapterId}
                isRead={lastReadOrder >= 0 && chapter.order <= lastReadOrder}
                onBookmark={user ? handleBookmark : undefined}
              />
            ));
          })()
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-5">
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
