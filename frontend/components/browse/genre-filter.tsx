'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CaretDownIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { TaxonomyItem } from '@/types/manga.types';

interface GenreFilterProps {
  genres: TaxonomyItem[];
  includeGenres: string[];
  excludeGenres: string[];
  onIncludeChange: (slugs: string[]) => void;
  onExcludeChange: (slugs: string[]) => void;
}

type GenreState = 'neutral' | 'include' | 'exclude';

interface PanelCoords {
  top: number;
  left: number;
}

/** Wide 4-column genre panel with tri-state: neutral → include → exclude → neutral */
export function GenreFilter({
  genres,
  includeGenres,
  excludeGenres,
  onIncludeChange,
  onExcludeChange,
}: GenreFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<PanelCoords>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Portal target only available client-side
  useEffect(() => setMounted(true), []);

  // Recompute panel position when open; track scroll/resize so it stays anchored
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen]);

  // Click-outside: panel is portaled, so check both trigger and panel refs
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideTrigger && !insidePanel) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getState = useCallback(
    (slug: string): GenreState => {
      if (includeGenres.includes(slug)) return 'include';
      if (excludeGenres.includes(slug)) return 'exclude';
      return 'neutral';
    },
    [includeGenres, excludeGenres],
  );

  const cycleState = useCallback(
    (slug: string) => {
      const current = getState(slug);
      const totalSelected = includeGenres.length + excludeGenres.length;

      if (current === 'neutral') {
        if (totalSelected >= 10) return;
        onIncludeChange([...includeGenres, slug]);
      } else if (current === 'include') {
        onIncludeChange(includeGenres.filter((s) => s !== slug));
        onExcludeChange([...excludeGenres, slug]);
      } else {
        onExcludeChange(excludeGenres.filter((s) => s !== slug));
      }
    },
    [getState, includeGenres, excludeGenres, onIncludeChange, onExcludeChange],
  );

  const filtered = search
    ? genres.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : genres;

  const selectedCount = includeGenres.length + excludeGenres.length;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold text-secondary uppercase tracking-[0.08em]">
        Genres {selectedCount > 0 && `(${selectedCount})`}
      </span>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="flex items-center justify-between w-full min-w-[140px] px-3 py-2 bg-hover border border-hover rounded text-sm text-primary hover:border-muted transition-colors cursor-pointer"
        >
          <span className={selectedCount ? 'text-primary' : 'text-muted'}>
            {selectedCount ? `${selectedCount} selected` : 'Any'}
          </span>
          <CaretDownIcon
            size={14}
            className={`ml-2 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Panel is portaled to body so ancestor overflow-hidden cannot clip it */}
        {mounted && isOpen && createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => { setIsOpen(false); setSearch(''); }}
            />
            <div
              ref={panelRef}
              style={{ top: coords.top, left: coords.left }}
              className="fixed z-50 w-[calc(100vw-6rem)] max-w-[700px] bg-elevated border border-hover rounded shadow-xl overflow-hidden"
              onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
            >
              {/* Search */}
              <div className="p-3 border-b border-hover">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search genres..."
                  className="w-full px-3 py-1.5 bg-surface border border-hover rounded text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  autoFocus
                />
              </div>

              {/* 4-column genre grid */}
              <div className="overflow-y-auto max-h-72 p-3" role="listbox" aria-label="Genres">
                {filtered.length === 0 && (
                  <span className="text-xs text-muted">No results</span>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1">
                  {filtered.map((genre) => {
                    const state = getState(genre.slug);
                    const isAtCap = selectedCount >= 10 && state === 'neutral';
                    return (
                      <button
                        key={genre.slug}
                        type="button"
                        role="option"
                        aria-selected={state !== 'neutral'}
                        disabled={isAtCap}
                        onClick={() => cycleState(genre.slug)}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors text-left',
                          state === 'neutral' && 'text-secondary hover:text-primary cursor-pointer',
                          state === 'include' && 'text-green-400 cursor-pointer',
                          state === 'exclude' && 'text-red-400 cursor-pointer',
                          isAtCap && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        {/* Checkbox indicator */}
                        <span
                          className={cn(
                            'w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-[8px]',
                            state === 'neutral' && 'border-muted',
                            state === 'include' && 'border-green-500 bg-green-500/20',
                            state === 'exclude' && 'border-red-500 bg-red-500/20',
                          )}
                        >
                          {state === 'include' && '+'}
                          {state === 'exclude' && '−'}
                        </span>
                        <span className="uppercase tracking-wide truncate">{genre.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="px-3 py-2 border-t border-hover">
                <p className="text-[10px] text-muted">
                  Click: include (+) | Click again: exclude (−) | Click again: clear
                  {selectedCount >= 10 && ' | Max 10 reached'}
                </p>
              </div>
            </div>
          </>,
          document.body,
        )}
      </div>
    </div>
  );
}
