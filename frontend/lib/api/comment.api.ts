import { apiClient } from '@/lib/api-client';
import type { Comment, PaginatedComments, CommentQueryParams } from '@/types/comment.types';

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

  listForManga: (mangaId: number, params?: CommentQueryParams) =>
    apiClient.get<PaginatedComments>(`/manga/${mangaId}/comments`, { params }).then((r) => r.data),

  listForChapter: (chapterId: number, params?: CommentQueryParams) =>
    apiClient.get<PaginatedComments>(`/chapters/${chapterId}/comments`, { params }).then((r) => r.data),

  getReplies: (commentId: number, params?: { page?: number; limit?: number }) =>
    apiClient.get<PaginatedComments>(`/comments/${commentId}/replies`, { params }).then((r) => r.data),

  create: (data: { commentableType: 'manga' | 'chapter'; commentableId: number; content: string; parentId?: number }) =>
    apiClient.post<Comment>('/comments', data).then((r) => r.data),

  update: (id: number, content: string) =>
    apiClient.patch<Comment>(`/comments/${id}`, { content }).then((r) => r.data),

  remove: (id: number) =>
    apiClient.delete(`/comments/${id}`),

  toggleLike: (id: number) =>
    apiClient.post<{ liked: boolean; likesCount: number }>(`/comments/${id}/like`).then((r) => r.data),
};
