'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { CaretDownIcon, XIcon } from '@phosphor-icons/react';

interface SearchableSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Live-search select: type to filter, click to pick. */
export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search...',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
    : [];

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setIsOpen(false);
      setSearch('');
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange('');
    setSearch('');
  }, [onChange]);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && (
        <span className="text-[10px] font-semibold text-secondary uppercase tracking-[0.08em]">
          {label}
        </span>
      )}
      <div className="relative">
        {/* Selected value or search input */}
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
                ref={inputRef}
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
                className={`ml-1 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </>
          )}
        </div>

        {/* Dropdown results */}
        {isOpen && search.length > 0 && (
          <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[180px] max-h-48 bg-elevated border border-hover rounded shadow-xl overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted">
                {search.length < 2 ? 'Type to search...' : 'No results'}
              </div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
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
