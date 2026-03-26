import { apiClient } from '@/lib/api-client';
import type { NotificationListResponse } from '@/lib/notification-types';

export const notificationApi = {
  getUnreadCount: () =>
    apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),

  list: (params?: { page?: number; limit?: number; type?: string }) =>
    apiClient.get<NotificationListResponse>('/notifications', { params }).then((r) => r.data),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.patch('/notifications/read-all').then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/notifications/${id}`).then((r) => r.data),
};
