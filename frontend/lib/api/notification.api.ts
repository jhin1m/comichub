import { apiClient } from '@/lib/api-client';

export const notificationApi = {
  getUnreadCount: () =>
    apiClient.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),
};
