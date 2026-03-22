'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = 'Any',
  searchable = false,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

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

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;
  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && (
        <span className="text-[10px] font-semibold text-secondary uppercase tracking-[0.08em]">
          {label}
        </span>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
          className="flex items-center justify-between w-full min-w-[140px] px-3 py-2 bg-hover border border-hover rounded text-sm text-primary hover:border-muted transition-colors cursor-pointer"
        >
          <span className={value ? 'text-primary' : 'text-muted'}>
            {selectedLabel}
          </span>
          <ChevronDown size={14} className={`ml-2 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[180px] max-h-60 bg-elevated border border-hover rounded shadow-xl overflow-hidden">
            {searchable && (
              <div className="p-2 border-b border-hover">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full px-2 py-1.5 bg-surface border border-hover rounded text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  autoFocus
                />
              </div>
            )}
            <div className="overflow-y-auto max-h-48">
              <button
                type="button"
                onClick={() => { onChange(''); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-hover transition-colors cursor-pointer ${
                  !value ? 'text-accent' : 'text-secondary'
                }`}
              >
                {placeholder}
              </button>
              {filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-hover transition-colors cursor-pointer ${
                    value === opt.value ? 'text-accent' : 'text-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {searchable && filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted">No results</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
