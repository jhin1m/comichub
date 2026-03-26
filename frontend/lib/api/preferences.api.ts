import { apiClient } from '@/lib/api-client';
import type { ContentPreferences } from '@/types/preferences.types';

// Only send fields the backend DTO accepts (strips stale localStorage keys)
const ALLOWED_KEYS: (keyof ContentPreferences)[] = [
  'hideNsfw',
  'excludedTypes',
  'excludedDemographics',
  'excludedGenreSlugs',
  'highlightedGenreSlugs',
];

function pickAllowed(data: Partial<ContentPreferences>): Partial<ContentPreferences> {
  const clean: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in data) clean[key] = data[key];
  }
  return clean as Partial<ContentPreferences>;
}

export const preferencesApi = {
  get: () =>
    apiClient.get<ContentPreferences>('/users/preferences').then((r) => r.data),

  update: (data: Partial<ContentPreferences>) =>
    apiClient.put<ContentPreferences>('/users/preferences', pickAllowed(data)).then((r) => r.data),
};
