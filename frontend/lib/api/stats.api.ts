import { apiClient } from '@/lib/api-client';

export interface PlatformStats {
  totalManga: number;
  totalChapters: number;
  dailyUpdates: number;
  newThisWeek: number;
}

export const statsApi = {
  overview: () =>
    apiClient.get<PlatformStats>('/stats/overview').then((r) => r.data),
};
