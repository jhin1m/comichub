'use client';
import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';

interface SearchBarProps {
  initialValue?: string;
  onSearch: (value: string) => void;
}

export function SearchBar({ initialValue = '', onSearch }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <MagnifyingGlassIcon
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search manga..."
        className="w-full pl-9 pr-4 py-2 bg-surface border border-default rounded-[4px] text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
      />
    </form>
  );
}
