'use client';

import type { ContentPreferences } from '@/types/preferences.types';

const DEMOGRAPHICS = [
  { value: 'shounen', label: 'Shounen', desc: 'Young male audience' },
  { value: 'shoujo', label: 'Shoujo', desc: 'Young female audience' },
  { value: 'seinen', label: 'Seinen', desc: 'Adult male audience' },
  { value: 'josei', label: 'Josei', desc: 'Adult female audience' },
  { value: 'none', label: 'None', desc: 'No demographic set' },
] as const;

interface DemographicFilterSectionProps {
  excludedDemographics: string[];
  onChange: (partial: Partial<ContentPreferences>) => void;
}

export function DemographicFilterSection({ excludedDemographics, onChange }: DemographicFilterSectionProps) {
  function toggleDemographic(value: string) {
    const next = excludedDemographics.includes(value)
      ? excludedDemographics.filter((d) => d !== value)
      : [...excludedDemographics, value];
    onChange({ excludedDemographics: next });
  }

  return (
    <section className="bg-surface border border-default rounded-lg p-6">
      <h2 className="font-heading text-primary text-xl mb-1">Demographics</h2>
      <p className="text-secondary text-sm mb-4">Uncheck to exclude from listings</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {DEMOGRAPHICS.map(({ value, label, desc }) => {
          const included = !excludedDemographics.includes(value);
          return (
            <label
              key={value}
              className="flex flex-col gap-1 cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => toggleDemographic(value)}
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
