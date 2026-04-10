import { apiClient } from '@/lib/api-client';
import type { BookmarkFolder, BookmarkStatus } from '@/types/bookmark.types';

export const bookmarkApi = {
  getFolders: () =>
    apiClient.get<BookmarkFolder[]>('/bookmarks/folders').then((r) => r.data),

  addBookmark: (mangaId: number, folderId: number) =>
    apiClient.post(`/bookmarks/${mangaId}`, { folderId }).then((r) => r.data),

  changeFolder: (mangaId: number, folderId: number) =>
    apiClient.patch(`/bookmarks/${mangaId}`, { folderId }).then((r) => r.data),

  removeBookmark: (mangaId: number) =>
    apiClient.delete(`/bookmarks/${mangaId}`).then((r) => r.data),

  removeBookmarkMany: (mangaIds: number[]) =>
    apiClient
      .delete<{ removed: number }>('/bookmarks/bulk', { data: { mangaIds } })
      .then((r) => r.data),

  changeFolderMany: (mangaIds: number[], folderId: number) =>
    apiClient
      .patch<{ updated: number; folderId: number }>('/bookmarks/bulk/folder', {
        mangaIds,
        folderId,
      })
      .then((r) => r.data),

  getStatus: (mangaId: number) =>
    apiClient.get<BookmarkStatus>(`/bookmarks/status/${mangaId}`).then((r) => r.data),

  getBookmarks: (params: Record<string, unknown>) =>
    apiClient.get('/bookmarks', { params }).then((r) => r.data),

  createFolder: (name: string) =>
    apiClient.post('/bookmarks/folders', { name }).then((r) => r.data),

  updateFolder: (id: number, data: { name?: string; order?: number }) =>
    apiClient.patch(`/bookmarks/folders/${id}`, data).then((r) => r.data),

  deleteFolder: (id: number) =>
    apiClient.delete(`/bookmarks/folders/${id}`).then((r) => r.data),

  importPreview: (file: File, format: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);
    return apiClient.post('/bookmarks/import/preview', formData).then((r) => r.data);
  },

  importBookmarks: (file: File, format: string, strategy: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);
    formData.append('strategy', strategy);
    return apiClient.post('/bookmarks/import', formData).then((r) => r.data);
  },

  exportBookmarks: (format: 'json' | 'xml', folderId?: number) =>
    apiClient.get('/bookmarks/export', {
      params: { format, folderId },
      responseType: 'blob',
    }).then((r) => r.data),
};
