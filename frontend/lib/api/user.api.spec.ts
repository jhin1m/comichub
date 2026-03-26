import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { userApi } from './user.api';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('userApi', () => {
  it('getMe returns user profile', async () => {
    server.use(
      http.get(`${BASE_URL}/users/me`, () =>
        HttpResponse.json(envelope({ id: 1, name: 'Test User', email: 'test@example.com', avatar: null, role: 'user' })),
      ),
    );
    const result = await userApi.getMe();
    expect(result).toHaveProperty('email', 'test@example.com');
  });

  it('getHistory returns paginated history', async () => {
    server.use(
      http.get(`${BASE_URL}/users/me/history`, () =>
        HttpResponse.json(envelope({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 })),
      ),
    );
    const result = await userApi.getHistory();
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('getFollows returns paginated follows', async () => {
    server.use(
      http.get(`${BASE_URL}/users/me/follows`, () =>
        HttpResponse.json(envelope({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 })),
      ),
    );
    const result = await userApi.getFollows();
    expect(result).toHaveProperty('total', 0);
  });
});
