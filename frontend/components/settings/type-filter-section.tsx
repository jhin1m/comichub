'use client';

import type { ContentPreferences } from '@/types/preferences.types';

const MANGA_TYPES = [
  { value: 'manga', label: 'Manga', desc: 'Japanese comics' },
  { value: 'manhwa', label: 'Manhwa', desc: 'Korean webtoons' },
  { value: 'manhua', label: 'Manhua', desc: 'Chinese comics' },
  { value: 'doujinshi', label: 'Doujinshi', desc: 'Fan-made works' },
] as const;

interface TypeFilterSectionProps {
  excludedTypes: string[];
  onChange: (partial: Partial<ContentPreferences>) => void;
}

export function TypeFilterSection({ excludedTypes, onChange }: TypeFilterSectionProps) {
  function toggleType(value: string) {
    const next = excludedTypes.includes(value)
      ? excludedTypes.filter((t) => t !== value)
      : [...excludedTypes, value];
    onChange({ excludedTypes: next });
  }

  return (
    <section className="bg-surface border border-default rounded-lg p-6">
      <h2 className="font-heading text-primary text-xl mb-1">Types</h2>
      <p className="text-secondary text-sm mb-4">Uncheck to exclude from listings</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MANGA_TYPES.map(({ value, label, desc }) => {
          const included = !excludedTypes.includes(value);
          return (
            <label
              key={value}
              className="flex flex-col gap-1 cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => toggleType(value)}
                  className="w-4 h-4 accent-accent cursor-pointer"
                />
                <span className={`text-sm font-medium ${included ? 'text-primary' : 'text-secondary line-through'}`}>
                  {label}
                </span>
              </div>
              <span className="text-xs text-secondary pl-6">{desc}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
