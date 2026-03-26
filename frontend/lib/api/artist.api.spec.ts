import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { artistApi } from './artist.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('artistApi', () => {
  it('list returns artist array', async () => {
    server.use(
      http.get(`${BASE_URL}/artists`, () =>
        HttpResponse.json(envelope([{ id: 1, name: 'Artist One', slug: 'artist-one' }])),
      ),
    );
    const result = await artistApi.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('slug', 'artist-one');
  });

  it('search returns filtered artist array', async () => {
    server.use(
      http.get(`${BASE_URL}/artists`, () =>
        HttpResponse.json(envelope([{ id: 2, name: 'Artist Two', slug: 'artist-two' }])),
      ),
    );
    const result = await artistApi.search('two');
    expect(result[0]).toHaveProperty('name', 'Artist Two');
  });
});
