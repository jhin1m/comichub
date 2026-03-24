import { apiClient } from '@/lib/api-client';
import type { ContentPreferences } from '@/types/preferences.types';

export const preferencesApi = {
  get: () =>
    apiClient.get<ContentPreferences>('/users/preferences').then((r) => r.data),

  update: (data: Partial<ContentPreferences>) =>
    apiClient.put<ContentPreferences>('/users/preferences', data).then((r) => r.data),
};
