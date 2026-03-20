'use client';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

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
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a5a] pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search manga..."
        className="w-full pl-9 pr-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[4px] text-sm text-[#f5f5f5] placeholder-[#5a5a5a] focus:outline-none focus:border-[#e63946] transition-colors"
      />
    </form>
  );
}
