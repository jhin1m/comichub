import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { AuthProvider } from './auth.context';
import { PreferencesProvider, usePreferences } from './preferences.context';
import { clearTokens } from '@/lib/api-client';
import { DEFAULT_PREFERENCES } from '@/types/preferences.types';

// Spy on sonner toasts so PUT/GET failure paths are observable.
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));
import { toast } from 'sonner';

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
  vi.mocked(toast.error).mockClear();
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

  // ─── DB-wins sync (Phase 2) ──────────────────────────────────────────

  it('fetches preferences from DB on login and overwrites localStorage (DB wins)', async () => {
    // Seed a conflicting local state — DB response must override it.
    const localPrefs = { ...DEFAULT_PREFERENCES, hideNsfw: false, excludedTypes: ['manhwa'] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localPrefs));
    localStorage.setItem('refreshToken', 'test-refresh-token');

    const serverPrefs = {
      hideNsfw: true,
      excludedTypes: [],
      excludedDemographics: ['seinen'],
      excludedGenreSlugs: ['horror'],
      highlightedGenreSlugs: ['action'],
    };
    server.use(
      http.get(`${BASE_URL}/users/preferences`, () =>
        HttpResponse.json(envelope(serverPrefs)),
      ),
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => expect(result.current.preferences.hideNsfw).toBe(true));
    expect(result.current.preferences.excludedDemographics).toEqual(['seinen']);
    expect(result.current.preferences.highlightedGenreSlugs).toEqual(['action']);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.hideNsfw).toBe(true);
    expect(stored.highlightedGenreSlugs).toEqual(['action']);
  });

  it('fetches preferences from DB on auth-restore (page reload with existing session)', async () => {
    // Simulate a page reload: refreshToken already present at mount.
    localStorage.setItem('refreshToken', 'test-refresh-token');

    const serverPrefs = {
      hideNsfw: false,
      excludedTypes: ['manhua'],
      excludedDemographics: [],
      excludedGenreSlugs: [],
      highlightedGenreSlugs: ['romance'],
    };
    server.use(
      http.get(`${BASE_URL}/users/preferences`, () =>
        HttpResponse.json(envelope(serverPrefs)),
      ),
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => expect(result.current.preferences.excludedTypes).toEqual(['manhua']));
    expect(result.current.preferences.highlightedGenreSlugs).toEqual(['romance']);
  });

  it('does not upload local prefs to DB on login (no PUT during sync)', async () => {
    const localPrefs = { ...DEFAULT_PREFERENCES, hideNsfw: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localPrefs));
    localStorage.setItem('refreshToken', 'test-refresh-token');

    let putCount = 0;
    server.use(
      http.put(`${BASE_URL}/users/preferences`, () => {
        putCount++;
        return HttpResponse.json(envelope(DEFAULT_PREFERENCES));
      }),
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    // Wait through the debounce window to confirm no PUT fires.
    await new Promise((r) => setTimeout(r, 600));

    expect(putCount).toBe(0);
  });

  it('shows toast on PUT failure but keeps optimistic local state', async () => {
    localStorage.setItem('refreshToken', 'test-refresh-token');
    // Distinct GET signal (highlightedGenreSlugs) so we can wait for login-sync to
    // settle before issuing the update — otherwise the GET response races with
    // the optimistic state change.
    server.use(
      http.get(`${BASE_URL}/users/preferences`, () =>
        HttpResponse.json(envelope({
          ...DEFAULT_PREFERENCES,
          highlightedGenreSlugs: ['signal'],
        })),
      ),
      http.put(`${BASE_URL}/users/preferences`, () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });
    await waitFor(() =>
      expect(result.current.preferences.highlightedGenreSlugs).toEqual(['signal']),
    );

    await act(async () => {
      await result.current.updatePreferences({ excludedTypes: ['manhwa'] });
    });

    expect(result.current.preferences.excludedTypes).toEqual(['manhwa']);

    // Wait past the 500ms debounce for the PUT failure + toast.
    await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 2000 });
    expect(result.current.preferences.excludedTypes).toEqual(['manhwa']);
  });

  it('shows toast on login-fetch failure and keeps local state', async () => {
    const localPrefs = { ...DEFAULT_PREFERENCES, hideNsfw: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localPrefs));
    localStorage.setItem('refreshToken', 'test-refresh-token');

    server.use(
      http.get(`${BASE_URL}/users/preferences`, () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 2000 });
    // Local state (hideNsfw: false) is preserved despite the server error.
    expect(result.current.preferences.hideNsfw).toBe(false);
  });
});
