'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import { searchApi, type SuggestItem } from '@/lib/api/search.api';
import { getMangaUrl } from '@/lib/utils/manga-url';

export function SearchAutocomplete() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SuggestItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* Cleanup debounce timer on unmount */
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /* Focus mobile input when opened */
  useEffect(() => {
    if (mobileOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [mobileOpen]);


  /* Debounced fetch suggestions */
  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchApi.suggest(trimmed);
        setResults(data);
        setOpen(data.length > 0);
        setActiveIndex(-1);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    fetchSuggestions(val);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      setOpen(false);
      setMobileOpen(false);
      router.push(`/browse?search=${encodeURIComponent(q)}`);
    }
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function closeMobileSearch() {
    setMobileOpen(false);
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  function selectItem(item: SuggestItem) {
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    router.push(getMangaUrl(item));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectItem(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      if (mobileOpen) closeMobileSearch();
    }
  }

  /* Shared dropdown for both desktop and mobile */
  const dropdown = (
    <>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-default rounded shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {results.map((item, i) => (
            <button
              key={item.id}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                i === activeIndex ? 'bg-hover' : 'hover:bg-elevated'
              }`}
            >
              <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-elevated border border-default">
                {item.cover ? (
                  <Image
                    src={item.cover}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-[8px]">
                    N/A
                  </div>
                )}
              </div>
              <span className="text-sm text-primary truncate leading-snug">
                {item.title}
              </span>
            </button>
          ))}
          <Link
            href={`/browse?search=${encodeURIComponent(query.trim())}`}
            onClick={() => { setOpen(false); setMobileOpen(false); }}
            className="block px-3.5 py-2.5 text-xs text-secondary hover:text-accent border-t border-default text-center transition-colors"
          >
            View all results for &quot;{query.trim()}&quot;
          </Link>
        </div>
      )}
      {loading && !open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-default rounded px-3.5 py-3 z-50">
          <div className="flex gap-2 items-center text-muted text-xs">
            <div className="w-3.5 h-3.5 border-2 border-muted border-t-transparent rounded-full animate-spin" />
            Searching...
          </div>
        </div>
      )}
    </>
  );

  return (
    <div ref={wrapRef} className="flex-1 flex justify-center">
      {/* Mobile: Search icon button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded text-secondary hover:bg-elevated hover:text-primary transition-colors ml-auto"
        aria-label="Open search"
      >
        <MagnifyingGlassIcon size={18} />
      </button>

      {/* Mobile: Drop-down search panel (below navbar) */}
      {mobileOpen && (
        <div className="fixed top-14 left-0 right-0 z-[60] bg-base border-b border-default shadow-lg md:hidden">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <form onSubmit={handleSubmit} className="flex-1 relative">
              <MagnifyingGlassIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                ref={mobileInputRef}
                type="text"
                name="search"
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => results.length > 0 && setOpen(true)}
                placeholder="Search comic..."
                autoComplete="off"
                className="w-full h-10 bg-elevated border border-default rounded pl-10 pr-10 text-sm text-primary placeholder:text-muted outline-none focus:border-hover transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <XIcon size={14} />
                </button>
              )}
            </form>
            <button
              type="button"
              onClick={closeMobileSearch}
              className="w-9 h-9 flex items-center justify-center rounded text-secondary hover:text-primary transition-colors shrink-0"
              aria-label="Close search"
            >
              <XIcon size={18} />
            </button>
          </div>
          {/* Mobile results — reuse shared dropdown */}
          <div className="relative px-3 pb-2">
            {dropdown}
          </div>
        </div>
      )}

      {/* Mobile: Backdrop to close search */}
      {mobileOpen && (
        <div
          className="fixed inset-0 top-14 z-[55] bg-black/40 md:hidden"
          onClick={closeMobileSearch}
        />
      )}

      {/* Desktop: Full search bar */}
      <div className="relative w-full max-w-[520px] min-w-0 hidden md:block">
        <form onSubmit={handleSubmit} className="flex">
          <div className="relative flex-1">
            <MagnifyingGlassIcon
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              ref={desktopInputRef}
              type="text"
              name="search"
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Search comic..."
              autoComplete="off"
              className="w-full h-10 bg-elevated border border-default rounded-l pl-10 pr-9 text-sm text-primary placeholder:text-muted outline-none focus:border-hover transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
          <Link
            href="/browse"
            className="h-10 flex items-center gap-1.5 px-4 bg-elevated border border-default border-l-0 rounded-r text-secondary text-xs font-semibold tracking-wide hover:bg-hover hover:text-primary transition-colors whitespace-nowrap shrink-0"
          >
            FILTER
          </Link>
        </form>
        {dropdown}
      </div>
    </div>
  );
}
