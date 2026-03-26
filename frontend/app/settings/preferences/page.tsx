'use client';

import { useEffect, useState } from 'react';
import { usePreferences } from '@/contexts/preferences.context';
import { genreApi } from '@/lib/api/genre.api';
import { TypeFilterSection } from '@/components/settings/type-filter-section';
import { DemographicFilterSection } from '@/components/settings/demographic-filter-section';
import { GenreFilterSection } from '@/components/settings/genre-filter-section';
import type { TaxonomyItem } from '@/types/manga.types';

export default function PreferencesPage() {
  const { preferences, updatePreferences, isLoaded } = usePreferences();
  const [genres, setGenres] = useState<TaxonomyItem[]>([]);
  useEffect(() => {
    genreApi.list().then(setGenres).catch(() => {});
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <p className="text-secondary text-sm">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base py-8 px-4">
      <div className="max-w-350 px-4 mx-auto flex flex-col gap-6">

        {/* Header */}
        <div>
          <h1 className="font-heading text-primary text-3xl">Content Preferences</h1>
          <p className="text-secondary text-sm mt-1">Choose what content you want to see</p>
        </div>

        {/* NSFW Toggle */}
        <section className="bg-surface border border-default rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-primary text-xl">NSFW Content</h2>
              <p className="text-secondary text-sm mt-0.5">Hide adult content from listings</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.hideNsfw}
              onClick={() => updatePreferences({ hideNsfw: !preferences.hideNsfw })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                preferences.hideNsfw ? 'bg-accent' : 'bg-elevated'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  preferences.hideNsfw ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* Types */}
        <TypeFilterSection
          excludedTypes={preferences.excludedTypes}
          onChange={updatePreferences}
        />

        {/* Demographics */}
        <DemographicFilterSection
          excludedDemographics={preferences.excludedDemographics}
          onChange={updatePreferences}
        />

        {/* Genres */}
        <GenreFilterSection
          genres={genres}
          excludedGenreSlugs={preferences.excludedGenreSlugs}
          highlightedGenreSlugs={preferences.highlightedGenreSlugs}
          onChange={updatePreferences}
        />
      </div>
    </div>
  );
}
