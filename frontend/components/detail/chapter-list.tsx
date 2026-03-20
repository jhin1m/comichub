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
      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#707070] pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search chapter..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm bg-elevated border border-[#2a2a2a] rounded-[4px] text-[#f5f5f5] placeholder-[#707070] focus:outline-none focus:border-[#404040] transition-colors"
        />
      </div>

      {/* Chapter rows */}
      <div className="max-h-[600px] overflow-y-auto space-y-0.5 pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-[#707070] py-4 text-center">No chapters found.</p>
        ) : (
          filtered.map((chapter) => (
            <ChapterListItemRow
              key={chapter.id}
              chapter={chapter}
              mangaSlug={mangaSlug}
            />
          ))
        )}
      </div>
    </div>
  );
}
