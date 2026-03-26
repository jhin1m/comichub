import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { AuthProvider, useAuth } from './auth.context';
import { clearTokens, setAccessToken } from '@/lib/api-client';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

beforeEach(() => {
  clearTokens();
  localStorage.clear();
});

describe('AuthProvider / useAuth', () => {
  it('resolves to loading false with no user when no refresh token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('restoreSession sets user when refresh token is valid', async () => {
    localStorage.setItem('refreshToken', 'valid-rt');

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.email).toBe('test@example.com');
  });

  it('restoreSession clears tokens when refresh fails', async () => {
    localStorage.setItem('refreshToken', 'bad-rt');
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () =>
        new HttpResponse(null, { status: 401 }),
      ),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('login stores tokens and sets user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login({ email: 'test@example.com', password: 'pass' });
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.email).toBe('test@example.com');
    expect(localStorage.getItem('refreshToken')).toBe('test-refresh-token');
  });

  it('logout clears user and tokens', async () => {
    localStorage.setItem('refreshToken', 'valid-rt');
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).not.toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('setTokensFromOAuth stores tokens and fetches user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setTokensFromOAuth('oauth-access', 'oauth-refresh');
    });

    expect(result.current.user).not.toBeNull();
    expect(localStorage.getItem('refreshToken')).toBe('oauth-refresh');
  });

  it('throws when useAuth used outside AuthProvider', () => {
    // renderHook without wrapper — context will be null
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');
  });
});
