import { apiClient } from '@/lib/api-client';

export interface RecentComment {
  id: number;
  content: string;
  createdAt: string;
  userName: string;
  userAvatar: string | null;
  mangaTitle: string | null;
  mangaSlug: string | null;
  mangaCover: string | null;
  chapterNumber: string | null;
}

export const commentApi = {
  recent: (limit = 10) =>
    apiClient.get<RecentComment[]>('/comments/recent', { params: { limit } }).then((r) => r.data),
};
