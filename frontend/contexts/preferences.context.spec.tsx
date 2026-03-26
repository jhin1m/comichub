import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { AuthProvider } from './auth.context';
import { PreferencesProvider, usePreferences } from './preferences.context';
import { clearTokens } from '@/lib/api-client';
import { DEFAULT_PREFERENCES } from '@/types/preferences.types';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });
const STORAGE_KEY = 'content-preferences';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    AuthProvider,
    null,
    React.createElement(PreferencesProvider, null, children),
  );
}

beforeEach(() => {
  clearTokens();
  localStorage.clear();
  vi.useRealTimers();
});

describe('PreferencesProvider / usePreferences', () => {
  it('loads default preferences on mount', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('loads preferences from localStorage when present', async () => {
    const stored = { ...DEFAULT_PREFERENCES, hideNsfw: false, excludedTypes: ['manhwa'] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.preferences.hideNsfw).toBe(false);
    expect(result.current.preferences.excludedTypes).toEqual(['manhwa']);
  });

  it('updatePreferences immediately updates local state', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.updatePreferences({ hideNsfw: false });
    });

    expect(result.current.preferences.hideNsfw).toBe(false);
  });

  it('updatePreferences writes to localStorage', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.updatePreferences({ excludedTypes: ['manhwa'] });
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.excludedTypes).toEqual(['manhwa']);
  });

  it('updatePreferences does not call API when user not logged in', async () => {
    // No refresh token — user stays null
    let apiCallCount = 0;
    server.use(
      http.put(`${BASE_URL}/users/preferences`, () => {
        apiCallCount++;
        return HttpResponse.json(envelope(DEFAULT_PREFERENCES));
      }),
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(async () => {
      await result.current.updatePreferences({ hideNsfw: false });
    });

    // Wait to confirm no debounced API call fires
    await new Promise((r) => setTimeout(r, 600));
    expect(apiCallCount).toBe(0);
  });

  it('throws when usePreferences used outside PreferencesProvider', () => {
    expect(() => {
      renderHook(() => usePreferences());
    }).toThrow('usePreferences must be used within PreferencesProvider');
  });
});
