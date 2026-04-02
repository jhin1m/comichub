import { apiClient } from '@/lib/api-client';
import type { MyProfile, FollowItem, HistoryItem } from '@/types/user.types';
import type { PaginatedResult } from '@/types/manga.types';

export const userApi = {
  getMe: () =>
    apiClient.get<MyProfile>('/users/me').then((r) => r.data),

  getHistory: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResult<HistoryItem>>('/users/me/history', { params: { page, limit } }).then((r) => r.data),

  getFollows: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResult<FollowItem>>('/users/me/follows', { params: { page, limit } }).then((r) => r.data),

  getLastRead: (mangaId: number) =>
    apiClient.get<{ chapterId: number; lastReadAt: string } | null>(`/users/me/history/${mangaId}`).then((r) => r.data),

  upsertHistory: (mangaId: number, chapterId: number) =>
    apiClient.post('/history', { mangaId, chapterId }).then((r) => r.data),

  removeHistory: (mangaId: number) =>
    apiClient.patch(`/users/me/history/${mangaId}`).then((r) => r.data),
};
