import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { commentApi } from './comment.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

const paginatedComments = {
  data: [{ id: 1, content: 'Hello', createdAt: '2026-01-01T00:00:00Z' }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

describe('commentApi', () => {
  it('recent returns comment list', async () => {
    server.use(
      http.get(`${BASE_URL}/comments/recent`, () =>
        HttpResponse.json(envelope([{ id: 1, content: 'Hi', createdAt: '2026-01-01T00:00:00Z', userName: 'User', userAvatar: null, mangaTitle: null, mangaSlug: null, mangaCover: null, chapterNumber: null }])),
      ),
    );
    const result = await commentApi.recent();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('content', 'Hi');
  });

  it('listForManga returns paginated comments', async () => {
    server.use(
      http.get(`${BASE_URL}/manga/1/comments`, () =>
        HttpResponse.json(envelope(paginatedComments)),
      ),
    );
    const result = await commentApi.listForManga(1);
    expect(result).toHaveProperty('data');
    expect(result.data[0]).toHaveProperty('id', 1);
  });

  it('create posts and returns new comment', async () => {
    server.use(
      http.post(`${BASE_URL}/comments`, () =>
        HttpResponse.json(envelope({ id: 99, content: 'New comment', createdAt: '2026-01-01T00:00:00Z' })),
      ),
    );
    const result = await commentApi.create({ commentableType: 'manga', commentableId: 1, content: 'New comment' });
    expect(result).toHaveProperty('id', 99);
  });
});
