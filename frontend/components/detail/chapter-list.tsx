'use client';
import { useState, useMemo } from 'react';
import { MagnifyingGlass, ListBullets, CaretDown, CaretUp } from '@phosphor-icons/react';
import { ChapterListItemRow } from './chapter-list-item';
import type { ChapterListItem } from '@/types/manga.types';

interface Props {
  chapters: ChapterListItem[];
  mangaSlug: string;
}

type SortField = 'number' | 'date' | 'views';
type SortDir = 'asc' | 'desc';

export function ChapterList({ chapters, mangaSlug }: Props) {
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

    if (query.trim()) {
      list = list.filter((ch) =>
        ch.number.toLowerCase().includes(query.toLowerCase())
      );
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
  }, [chapters, query, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? (
      <CaretDown size={12} className="text-accent" />
    ) : (
      <CaretUp size={12} className="text-accent" />
    );
  };

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <ListBullets size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">
            Chapters
          </h2>
          <span className="text-xs text-muted">
            ({chapters.length})
          </span>
        </div>

        {/* Search */}
        <div className="relative w-full max-w-[200px]">
          <MagnifyingGlass
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search chapter..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-elevated border border-default rounded-md text-primary placeholder:text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center px-3 py-2 bg-elevated/60 border-b border-default text-xs text-muted select-none">
        <button
          onClick={() => handleSort('number')}
          className="flex items-center gap-1 hover:text-secondary transition-colors w-[140px] shrink-0"
        >
          Chapter <SortIcon field="number" />
        </button>
        <span className="flex-1" />
        <button
          onClick={() => handleSort('views')}
          className="flex items-center gap-1 hover:text-secondary transition-colors w-[70px] justify-end shrink-0"
        >
          Views <SortIcon field="views" />
        </button>
        <button
          onClick={() => handleSort('date')}
          className="flex items-center gap-1 hover:text-secondary transition-colors w-[80px] justify-end shrink-0"
        >
          Date <SortIcon field="date" />
        </button>
      </div>

      {/* Chapter rows */}
      <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">No chapters found.</p>
        ) : (
          filtered.map((chapter, index) => (
            <ChapterListItemRow
              key={chapter.id}
              chapter={chapter}
              mangaSlug={mangaSlug}
              striped={index % 2 === 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
