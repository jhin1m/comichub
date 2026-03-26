import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { notificationApi } from './notification.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('notificationApi', () => {
  it('list returns notification list response', async () => {
    const result = await notificationApi.list();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('unreadCount', 0);
  });

  it('getUnreadCount returns count', async () => {
    server.use(
      http.get(`${BASE_URL}/notifications/unread-count`, () =>
        HttpResponse.json(envelope({ count: 5 })),
      ),
    );
    const result = await notificationApi.getUnreadCount();
    expect(result).toHaveProperty('count', 5);
  });

  it('markAllRead resolves without error', async () => {
    server.use(
      http.patch(`${BASE_URL}/notifications/read-all`, () =>
        HttpResponse.json(envelope(null)),
      ),
    );
    await expect(notificationApi.markAllRead()).resolves.toBeNull();
  });
});
