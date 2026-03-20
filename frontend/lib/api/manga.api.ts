import { apiClient } from '@/lib/api-client';
import type { MangaListItem, MangaDetail, PaginatedResult, MangaQueryParams } from '@/types/manga.types';

export const mangaApi = {
  list: (params?: MangaQueryParams) =>
    apiClient.get<PaginatedResult<MangaListItem>>('/manga', { params }).then((r) => r.data),

  detail: (slug: string) =>
    apiClient.get<MangaDetail>(`/manga/${slug}`).then((r) => r.data),

  hot: (page = 1, limit = 10) =>
    apiClient.get<PaginatedResult<MangaListItem>>('/manga/hot', { params: { page, limit } }).then((r) => r.data),

  toggleFollow: (mangaId: number) =>
    apiClient.post(`/manga/${mangaId}/follow`).then((r) => r.data),

  isFollowed: (mangaId: number) =>
    apiClient.get<{ isFollowed: boolean }>(`/manga/${mangaId}/is-followed`).then((r) => r.data),
};
