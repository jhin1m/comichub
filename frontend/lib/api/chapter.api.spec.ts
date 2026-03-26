import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { chapterApi } from './chapter.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('chapterApi', () => {
  it('getWithImages returns chapter with images', async () => {
    server.use(
      http.get(`${BASE_URL}/chapters/1`, () =>
        HttpResponse.json(envelope({ id: 1, number: 1, images: ['img1.jpg'] })),
      ),
    );
    const result = await chapterApi.getWithImages(1);
    expect(result).toHaveProperty('id', 1);
    expect(result).toHaveProperty('images');
  });

  it('getNavigation returns prev/next chapter info', async () => {
    server.use(
      http.get(`${BASE_URL}/chapters/1/navigation`, () =>
        HttpResponse.json(envelope({ prev: null, next: { id: 2, number: 2 } })),
      ),
    );
    const result = await chapterApi.getNavigation(1);
    expect(result).toHaveProperty('next');
  });

  it('listByManga returns chapter list', async () => {
    server.use(
      http.get(`${BASE_URL}/manga/1/chapters`, () =>
        HttpResponse.json(envelope([{ id: 1, number: 1, title: 'Chapter 1' }])),
      ),
    );
    const result = await chapterApi.listByManga(1);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('number', 1);
  });
});
