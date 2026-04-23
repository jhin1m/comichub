'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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

function writeCookie(prefs: ContentPreferences) {
  if (typeof window === 'undefined') return;
  try {
    document.cookie = `content-prefs=${encodeURIComponent(JSON.stringify(prefs))}; path=/; max-age=31536000; SameSite=Lax`;
  } catch { /* ignore */ }
}

function writeLocalStorage(prefs: ContentPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    writeCookie(prefs);
  } catch {
    // ignore quota errors
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [preferences, setPreferences] = useState<ContentPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const prevUserRef = useRef<typeof user>(undefined);

  // Mount: read from localStorage and sync to cookie for RSC access
  useEffect(() => {
    const stored = readLocalStorage();
    if (stored) {
      const merged = { ...DEFAULT_PREFERENCES, ...stored };
      setPreferences(merged);
      writeCookie(merged);
    }
    setIsLoaded(true);
  }, []);

  // Auth change: DB-wins on login + auth-restore; keep local as guest prefs on logout.
  useEffect(() => {
    if (!isLoaded || loading) return;

    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    // Login OR auth-restore (undefined/null → user): DB is source of truth.
    if (!prevUser && user) {
      (async () => {
        try {
          const apiPrefs = await preferencesApi.get();
          setPreferences(apiPrefs);
          writeLocalStorage(apiPrefs);
        } catch {
          toast.error('Không thể đồng bộ tuỳ chọn từ máy chủ.');
        }
      })();
      return;
    }

    // Logout: keep current prefs as guest prefs.
    if (prevUser && !user) {
      writeLocalStorage(preferences);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, isLoaded]);

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
          toast.error('Không thể lưu tuỳ chọn. Vui lòng thử lại.');
        }
      }, 500);
    }
  }, [user]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (apiDebounceRef.current) clearTimeout(apiDebounceRef.current);
    };
  }, []);

  const value = useMemo(() => ({
    preferences,
    updatePreferences,
    isLoaded,
    highlightedGenreSlugs: preferences.highlightedGenreSlugs,
  }), [preferences, updatePreferences, isLoaded]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
