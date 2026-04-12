import { apiClient } from '@/lib/api-client';
import type { MangaListItem, MangaDetail, PaginatedResult, MangaQueryParams, GroupDetailResponse } from '@/types/manga.types';

export type RankingPeriod = 'daily' | 'weekly' | 'alltime' | 'toprated';

export const mangaApi = {
  list: (params?: MangaQueryParams) =>
    apiClient.get<PaginatedResult<MangaListItem>>('/manga', { params }).then((r) => r.data),

  detail: (slug: string) =>
    apiClient.get<MangaDetail>(`/manga/${slug}`).then((r) => r.data),

  random: () =>
    apiClient.get<{ id: number; slug: string }>('/manga/random').then((r) => r.data),

  hot: (page = 1, limit = 10) =>
    apiClient.get<PaginatedResult<MangaListItem>>('/manga/hot', { params: { page, limit } }).then((r) => r.data),

  // Rankings endpoints return a plain array, not a paginated result
  rankings: (period: RankingPeriod, page = 1, limit = 10) =>
    apiClient
      .get<MangaListItem[]>(`/manga/rankings/${period}`, { params: { page, limit } })
      .then((r) => r.data),

  toggleFollow: (mangaId: number) =>
    apiClient.post(`/manga/${mangaId}/follow`).then((r) => r.data),

  isFollowed: (mangaId: number) =>
    apiClient.get<{ followed: boolean; following?: boolean }>(`/manga/${mangaId}/follow`).then((r) => r.data),

  /** Rate manga (0.5–5.0) */
  rate: (mangaId: number, score: number) =>
    apiClient.post(`/manga/${mangaId}/rate`, { score }).then((r) => r.data),

  /** Get current user's rating for a manga */
  getUserRating: (mangaId: number) =>
    apiClient.get<{ score: number | null }>(`/manga/${mangaId}/rating`).then((r) => r.data),

  /** Remove user's rating */
  removeRating: (mangaId: number) =>
    apiClient.delete(`/manga/${mangaId}/rate`).then((r) => r.data),

  /** Get similar manga by genre (fetches limit+1 to compensate for excluding current) */
  similar: (genreSlug: string, excludeId: number, limit = 6) =>
    apiClient
      .get<PaginatedResult<MangaListItem>>('/manga', {
        params: { genre: genreSlug, limit: limit + 1, page: 1 },
      })
      .then((r) => r.data.data.filter((m) => m.id !== excludeId).slice(0, limit)),

  /** Report a chapter */
  reportChapter: (chapterId: number, type: string, description?: string) =>
    apiClient.post(`/chapters/${chapterId}/report`, { type, description }).then((r) => r.data),
};

export const groupApi = {
  detail: (slug: string, page = 1, limit = 20) =>
    apiClient.get<GroupDetailResponse>(`/groups/${slug}/manga`, { params: { page, limit } }).then((r) => r.data),
};
