import { useMemo } from 'react';
import { usePreferences } from '@/contexts/preferences.context';

export interface PreferencesParams {
  excludeTypes?: string;
  excludeDemographics?: string;
  excludeGenres?: string;
  nsfw?: boolean;
}

export function usePreferencesParams(): { params: PreferencesParams; isLoaded: boolean } {
  const { preferences, isLoaded } = usePreferences();

  const params = useMemo<PreferencesParams>(() => ({
    excludeTypes: preferences.excludedTypes.length
      ? preferences.excludedTypes.join(',') : undefined,
    excludeDemographics: preferences.excludedDemographics.length
      ? preferences.excludedDemographics.join(',') : undefined,
    excludeGenres: preferences.excludedGenreSlugs.length
      ? preferences.excludedGenreSlugs.join(',') : undefined,
    // Only opt-in when user wants NSFW; omit (undefined) lets BE default-deny apply
    nsfw: preferences.hideNsfw ? undefined : true,
  }), [preferences]);

  return { params, isLoaded };
}
