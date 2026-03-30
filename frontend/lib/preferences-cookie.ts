import { cookies } from 'next/headers';
import { DEFAULT_PREFERENCES } from '@/types/preferences.types';
import type { ContentPreferences } from '@/types/preferences.types';

/** Read user content preferences from cookie (for RSC pages) */
export async function getPreferencesFromCookies(): Promise<ContentPreferences> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('content-prefs')?.value;
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Build browse API query params from preferences */
export function buildPreferenceParams(prefs: ContentPreferences) {
  return {
    excludeTypes: prefs.excludedTypes.length ? prefs.excludedTypes.join(',') : undefined,
    excludeDemographics: prefs.excludedDemographics.length ? prefs.excludedDemographics.join(',') : undefined,
    excludeGenres: prefs.excludedGenreSlugs.length ? prefs.excludedGenreSlugs.join(',') : undefined,
    nsfw: prefs.hideNsfw ? false : undefined,
  };
}
