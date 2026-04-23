import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '@/contexts/auth.context';
import { PreferencesProvider } from '@/contexts/preferences.context';
import { DEFAULT_PREFERENCES } from '@/types/preferences.types';
import { usePreferencesParams } from './use-preferences-params';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    AuthProvider,
    null,
    React.createElement(PreferencesProvider, null, children),
  );
}

describe('usePreferencesParams', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns isLoaded and params object', () => {
    const { result } = renderHook(() => usePreferencesParams(), { wrapper });
    expect(result.current).toHaveProperty('params');
    expect(result.current).toHaveProperty('isLoaded');
  });

  it('excludeTypes is undefined when excludedTypes is empty', () => {
    const { result } = renderHook(() => usePreferencesParams(), { wrapper });
    expect(result.current.params.excludeTypes).toBeUndefined();
  });

  it('excludeDemographics is undefined when excludedDemographics is empty', () => {
    const { result } = renderHook(() => usePreferencesParams(), { wrapper });
    expect(result.current.params.excludeDemographics).toBeUndefined();
  });

  it('nsfw is undefined when hideNsfw is true (default)', async () => {
    const { result } = renderHook(() => usePreferencesParams(), { wrapper });
    // Wait for provider mount effect to run
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    // Default hideNsfw=true => omit nsfw so BE default-deny applies
    expect(result.current.params.nsfw).toBeUndefined();
  });

  it('nsfw is true when hideNsfw is false', async () => {
    // Seed localStorage BEFORE provider mounts — provider reads on mount
    localStorage.setItem(
      'content-preferences',
      JSON.stringify({ ...DEFAULT_PREFERENCES, hideNsfw: false }),
    );
    const { result } = renderHook(() => usePreferencesParams(), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    // User opted in => nsfw must be explicit true so BE bypasses filter
    expect(result.current.params.nsfw).toBe(true);
  });
});
