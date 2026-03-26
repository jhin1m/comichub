'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { CaretDownIcon, XIcon } from '@phosphor-icons/react';

interface SearchableSelectProps {
  label: string;
  value: string;
  selectedLabel?: string;
  onSearch: (query: string) => Promise<{ value: string; label: string }[]>;
  onChange: (value: string, label: string) => void;
  placeholder?: string;
}

/** Async search select: type to search API, click to pick. */
export function SearchableSelect({
  label,
  value,
  selectedLabel = '',
  onSearch,
  onChange,
  placeholder = 'Search...',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ value: string; label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await onSearch(search);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, onSearch]);

  const handleSelect = useCallback(
    (val: string, lbl: string) => {
      onChange(val, lbl);
      setIsOpen(false);
      setSearch('');
      setResults([]);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange('', '');
    setSearch('');
    setResults([]);
  }, [onChange]);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && (
        <span className="text-[10px] font-semibold text-secondary uppercase tracking-[0.08em]">
          {label}
        </span>
      )}
      <div className="relative">
        <div className="flex items-center w-full px-3 py-2 bg-hover border border-hover rounded text-sm transition-colors">
          {value && !isOpen ? (
            <>
              <span className="flex-1 text-primary truncate">{selectedLabel}</span>
              <button
                type="button"
                onClick={handleClear}
                className="ml-1 text-muted hover:text-primary cursor-pointer"
              >
                <XIcon size={12} />
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                placeholder={value ? selectedLabel : placeholder}
                className="flex-1 bg-transparent text-primary placeholder:text-muted focus:outline-none text-sm"
              />
              <CaretDownIcon
                size={14}
                className={`ml-1 text-muted transition-transform ${isOpen ? 'rotate-180' : ''} ${isLoading ? 'animate-spin' : ''}`}
              />
            </>
          )}
        </div>

        {isOpen && search.length > 0 && (
          <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[180px] max-h-48 bg-elevated border border-hover rounded shadow-xl overflow-y-auto">
            {isLoading && (
              <div className="px-3 py-2 text-xs text-muted">Searching...</div>
            )}
            {!isLoading && search.length < 2 && (
              <div className="px-3 py-2 text-xs text-muted">Type at least 2 characters...</div>
            )}
            {!isLoading && search.length >= 2 && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted">No results</div>
            )}
            {results.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value, opt.label)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-hover transition-colors cursor-pointer ${
                  value === opt.value ? 'text-accent' : 'text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
