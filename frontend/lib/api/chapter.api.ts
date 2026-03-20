import { apiClient } from '@/lib/api-client';
import type { ChapterWithImages, ChapterNavigation } from '@/types/manga.types';

export const chapterApi = {
  getWithImages: (id: number) =>
    apiClient.get<ChapterWithImages>(`/chapters/${id}`).then((r) => r.data),

  getNavigation: (id: number) =>
    apiClient.get<ChapterNavigation>(`/chapters/${id}/navigation`).then((r) => r.data),
};
