import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { mangaApi } from './manga.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('mangaApi', () => {
  it('list returns paginated manga', async () => {
    const result = await mangaApi.list();
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0]).toHaveProperty('title', 'Test Manga');
  });

  it('detail returns manga detail', async () => {
    server.use(
      http.get(`${BASE_URL}/manga/test-slug`, () =>
        HttpResponse.json(envelope({ id: 1, title: 'Test Manga', slug: 'test-slug' })),
      ),
    );
    const result = await mangaApi.detail('test-slug');
    expect(result).toHaveProperty('slug', 'test-slug');
  });

  it('random returns a slug', async () => {
    server.use(
      http.get(`${BASE_URL}/manga/random`, () =>
        HttpResponse.json(envelope({ slug: 'random-manga' })),
      ),
    );
    const result = await mangaApi.random();
    expect(result).toHaveProperty('slug', 'random-manga');
  });

  it('toggleFollow posts and returns data', async () => {
    server.use(
      http.post(`${BASE_URL}/manga/1/follow`, () =>
        HttpResponse.json(envelope({ followed: true })),
      ),
    );
    const result = await mangaApi.toggleFollow(1);
    expect(result).toHaveProperty('followed', true);
  });
});
