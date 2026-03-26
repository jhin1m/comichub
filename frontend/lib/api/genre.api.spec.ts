import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { genreApi } from './genre.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('genreApi', () => {
  it('list returns genre array', async () => {
    server.use(
      http.get(`${BASE_URL}/genres`, () =>
        HttpResponse.json(envelope([{ id: 1, name: 'Action', slug: 'action' }])),
      ),
    );
    const result = await genreApi.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('slug', 'action');
  });

  it('list returns empty array when no genres', async () => {
    server.use(
      http.get(`${BASE_URL}/genres`, () =>
        HttpResponse.json(envelope([])),
      ),
    );
    const result = await genreApi.list();
    expect(result).toEqual([]);
  });
});
