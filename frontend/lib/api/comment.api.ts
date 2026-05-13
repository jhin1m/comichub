import { apiClient } from '@/lib/api-client';
import type {
  Comment,
  PaginatedComments,
  CommentQueryParams,
  CommentRevision,
  CommentReportPayload,
  MentionUserSuggestion,
} from '@/types/comment.types';

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
    apiClient.post<{ liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number }>(`/comments/${id}/like`).then((r) => r.data),

  toggleDislike: (id: number) =>
    apiClient.post<{ liked: boolean; disliked: boolean; likesCount: number; dislikesCount: number }>(`/comments/${id}/dislike`).then((r) => r.data),

  // Phase 4: pin/unpin (admin) + revisions (public)
  pin: (id: number) =>
    apiClient.post<Comment>(`/comments/${id}/pin`).then((r) => r.data),

  unpin: (id: number) =>
    apiClient.delete<Comment>(`/comments/${id}/pin`).then((r) => r.data),

  getRevisions: (id: number) =>
    apiClient.get<CommentRevision[]>(`/comments/${id}/revisions`).then((r) => r.data),

  // Phase 3: user reports
  report: (id: number, payload: CommentReportPayload) =>
    apiClient.post(`/comments/${id}/report`, payload).then((r) => r.data),

  // Phase 2: user search (mention autocomplete)
  searchUsers: (q: string, limit = 10) =>
    apiClient
      .get<MentionUserSuggestion[]>('/users/search', { params: { q, limit } })
      .then((r) => r.data),
};

// Phase 3: admin queue API
export interface AdminCommentReportRow {
  id: number;
  commentId: number;
  reason: string;
  details: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt: string | null;
  reporterId: number;
  reporterName: string | null;
  reporterAvatar: string | null;
  commentContent: string | null;
  commentAuthorId: number | null;
  commentDeletedAt: string | null;
}

export const adminCommentReportsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient
      .get<{ data: AdminCommentReportRow[]; total: number; page: number; limit: number }>(
        '/admin/comment-reports',
        { params },
      )
      .then((r) => r.data),
  resolve: (
    id: number,
    action: 'dismiss' | 'delete_comment' | 'warn_user',
    resolutionNote?: string,
  ) =>
    apiClient
      .patch(`/admin/comment-reports/${id}`, { action, resolutionNote })
      .then((r) => r.data),
};
