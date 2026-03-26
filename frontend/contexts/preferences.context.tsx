'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { preferencesApi } from '@/lib/api/preferences.api';
import { DEFAULT_PREFERENCES } from '@/types/preferences.types';
import type { ContentPreferences } from '@/types/preferences.types';

const STORAGE_KEY = 'content-preferences';

interface PreferencesContextValue {
  preferences: ContentPreferences;
  updatePreferences: (partial: Partial<ContentPreferences>) => Promise<void>;
  isLoaded: boolean;
  highlightedGenreSlugs: string[];
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readLocalStorage(): ContentPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Strip stale keys — only keep fields defined in ContentPreferences
    return {
      hideNsfw: parsed.hideNsfw ?? DEFAULT_PREFERENCES.hideNsfw,
      excludedTypes: parsed.excludedTypes ?? DEFAULT_PREFERENCES.excludedTypes,
      excludedDemographics: parsed.excludedDemographics ?? DEFAULT_PREFERENCES.excludedDemographics,
      excludedGenreSlugs: parsed.excludedGenreSlugs ?? DEFAULT_PREFERENCES.excludedGenreSlugs,
      highlightedGenreSlugs: parsed.highlightedGenreSlugs ?? DEFAULT_PREFERENCES.highlightedGenreSlugs,
    };
  } catch {
    return null;
  }
}

function writeLocalStorage(prefs: ContentPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<ContentPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const prevUserRef = useRef<typeof user>(undefined);

  // Mount: read from localStorage
  useEffect(() => {
    const stored = readLocalStorage();
    if (stored) setPreferences({ ...DEFAULT_PREFERENCES, ...stored });
    setIsLoaded(true);
  }, []);

  // Auth change: sync on login/logout
  useEffect(() => {
    if (!isLoaded) return;
    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    // user just logged in (was null/undefined, now has value)
    if (!prevUser && user) {
      const localPrefs = readLocalStorage();
      const syncAndFetch = async () => {
        try {
          if (localPrefs) {
            await preferencesApi.update(localPrefs);
          }
          const apiPrefs = await preferencesApi.get();
          setPreferences(apiPrefs);
          writeLocalStorage(apiPrefs);
        } catch {
          // keep local state on error
        }
      };
      syncAndFetch();
      return;
    }

    // user just logged out (had value, now null)
    if (prevUser && !user) {
      writeLocalStorage(preferences);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoaded]);

  const apiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPrefsRef = useRef(preferences);
  latestPrefsRef.current = preferences;

  const updatePreferences = useCallback(async (partial: Partial<ContentPreferences>) => {
    // Immediate local update — no lag
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      writeLocalStorage(next);
      return next;
    });

    // Debounce API save (batches rapid clicks)
    if (user) {
      if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current);
      apiDebounceRef.current = setTimeout(async () => {
        try {
          const updated = await preferencesApi.update(latestPrefsRef.current);
          setPreferences(updated);
          writeLocalStorage(updated);
        } catch {
          // optimistic update stays
        }
      }, 500);
    }
  }, [user]);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        isLoaded,
        highlightedGenreSlugs: preferences.highlightedGenreSlugs,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
