import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { searchApi } from './search.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('searchApi', () => {
  it('suggest returns matching items for query', async () => {
    server.use(
      http.get(`${BASE_URL}/search/suggest`, () =>
        HttpResponse.json(envelope([{ id: 1, title: 'Naruto', slug: 'naruto', cover: null }])),
      ),
    );
    const result = await searchApi.suggest('naruto');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('slug', 'naruto');
  });

  it('suggest returns empty array when no results', async () => {
    server.use(
      http.get(`${BASE_URL}/search/suggest`, () =>
        HttpResponse.json(envelope([])),
      ),
    );
    const result = await searchApi.suggest('zzznomatch');
    expect(result).toEqual([]);
  });
});
