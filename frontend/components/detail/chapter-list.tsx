'use client';
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { ChapterListItemRow } from './chapter-list-item';
import type { ChapterListItem } from '@/types/manga.types';

interface Props {
  chapters: ChapterListItem[];
  mangaSlug: string;
}

export function ChapterList({ chapters, mangaSlug }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...chapters].sort((a, b) => b.order - a.order);
    if (!query.trim()) return sorted;
    return sorted.filter((ch) =>
      ch.number.toLowerCase().includes(query.toLowerCase())
    );
  }, [chapters, query]);

  return (
    <div className="space-y-3">
      {/* Search input — compact */}
      <div className="relative w-full max-w-[240px]">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          type="text"
          placeholder="Go to chap..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 text-xs bg-elevated border border-default rounded-[4px] text-primary placeholder:text-muted focus:outline-none focus:border-hover transition-colors"
        />
      </div>

      {/* Chapter rows with alternating colors */}
      <div className="max-h-[600px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No chapters found.</p>
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
