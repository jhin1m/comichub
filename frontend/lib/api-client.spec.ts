import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { apiClient, setAccessToken, getAccessToken, clearTokens } from './api-client';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

beforeEach(() => {
  clearTokens();
  localStorage.clear();
});

describe('apiClient', () => {
  it('has correct baseURL', () => {
    expect(apiClient.defaults.baseURL).toBe(BASE_URL);
  });

  it('adds Authorization header when token is set', async () => {
    setAccessToken('my-token');
    let capturedAuth: string | null = null;

    server.use(
      http.get(`${BASE_URL}/test-auth-header`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json(envelope({ ok: true }));
      }),
    );

    await apiClient.get('/test-auth-header');
    expect(capturedAuth).toBe('Bearer my-token');
  });

  it('skips Authorization header when no token', async () => {
    let capturedAuth: string | null = 'initial';

    server.use(
      http.get(`${BASE_URL}/test-no-header`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json(envelope({ ok: true }));
      }),
    );

    await apiClient.get('/test-no-header');
    expect(capturedAuth).toBeNull();
  });

  it('unwraps envelope {success, data} to data', async () => {
    server.use(
      http.get(`${BASE_URL}/test-unwrap`, () =>
        HttpResponse.json(envelope({ value: 42 })),
      ),
    );

    const res = await apiClient.get('/test-unwrap');
    expect(res.data).toEqual({ value: 42 });
  });

  it('passes through response without envelope unchanged', async () => {
    server.use(
      http.get(`${BASE_URL}/test-plain`, () =>
        HttpResponse.json({ hello: 'world' }),
      ),
    );

    const res = await apiClient.get('/test-plain');
    expect(res.data).toEqual({ hello: 'world' });
  });

  it('triggers refresh flow on 401 and retries request', async () => {
    localStorage.setItem('refreshToken', 'valid-refresh-token');
    setAccessToken('expired-token');

    let callCount = 0;

    server.use(
      http.get(`${BASE_URL}/test-401-refresh`, () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json(envelope({ secret: 'data' }));
      }),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(envelope({
          accessToken: 'refreshed-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        })),
      ),
    );

    const res = await apiClient.get('/test-401-refresh');
    expect(res.data).toEqual({ secret: 'data' });
    expect(getAccessToken()).toBe('refreshed-token');
  });

  it('clears tokens when refresh fails', async () => {
    localStorage.setItem('refreshToken', 'bad-refresh-token');
    setAccessToken('expired-token');

    server.use(
      http.get(`${BASE_URL}/test-401-fail`, () =>
        new HttpResponse(null, { status: 401 }),
      ),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        new HttpResponse(null, { status: 401 }),
      ),
    );

    await expect(apiClient.get('/test-401-fail')).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
  });
});

describe('token helpers', () => {
  it('setAccessToken / getAccessToken round-trip', () => {
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
  });

  it('clearTokens resets access token and removes refreshToken from localStorage', () => {
    setAccessToken('abc');
    localStorage.setItem('refreshToken', 'rt');
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });
});
