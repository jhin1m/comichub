import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { authorApi } from './author.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('authorApi', () => {
  it('list returns author array', async () => {
    server.use(
      http.get(`${BASE_URL}/authors`, () =>
        HttpResponse.json(envelope([{ id: 1, name: 'Author One', slug: 'author-one' }])),
      ),
    );
    const result = await authorApi.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('slug', 'author-one');
  });

  it('search returns filtered author array', async () => {
    server.use(
      http.get(`${BASE_URL}/authors`, () =>
        HttpResponse.json(envelope([{ id: 2, name: 'Author Two', slug: 'author-two' }])),
      ),
    );
    const result = await authorApi.search('two');
    expect(result[0]).toHaveProperty('name', 'Author Two');
  });
});
