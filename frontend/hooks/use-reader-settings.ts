'use client';

import { useState, useEffect, useCallback } from 'react';

export type DisplayMode = 'single' | 'double' | 'longstrip';
export type ProgressPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';
export type FitMode = 'width' | 'height' | 'original';
export type ReadingDirection = 'ltr' | 'rtl';
export type ColorFilter = 'normal' | 'sepia' | 'warm' | 'cool';

export interface ReaderSettings {
  zoom: number;
  displayMode: DisplayMode;
  stripMargin: number;
  progressPosition: ProgressPosition;
  fitMode: FitMode;
  readingDirection: ReadingDirection;
  colorFilter: ColorFilter;
  brightness: number;
  contrast: number;
  saturation: number;
}

const STORAGE_KEY = 'comichub:reader-settings';

const defaults: ReaderSettings = {
  zoom: 68,
  displayMode: 'longstrip',
  stripMargin: 0,
  progressPosition: 'left',
  fitMode: 'width',
  readingDirection: 'ltr',
  colorFilter: 'normal',
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

function loadSettings(): ReaderSettings {
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  } catch {
    return defaults;
  }
}

/** Manages all reader settings with automatic localStorage persistence. */
export function useReaderSettings() {
  // Always start with defaults to match SSR, then hydrate from localStorage
  const [settings, setSettings] = useState<ReaderSettings>(defaults);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    const stored = loadSettings();
    setSettings(stored);
    setHydrated(true);
  }, []);

  // Persist on every change (skip the initial hydration write)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* quota exceeded — ignore */ }
  }, [settings, hydrated]);

  const update = useCallback(<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings(defaults), []);

  /** CSS filter string derived from image settings. */
  const imageFilterStyle = buildFilterStyle(settings);

  return { settings, update, reset, imageFilterStyle };
}

function buildFilterStyle(s: ReaderSettings): string {
  const parts: string[] = [];

  // Color filter presets
  switch (s.colorFilter) {
    case 'sepia':
      parts.push('sepia(0.3)');
      break;
    case 'warm':
      parts.push('sepia(0.15)', 'saturate(1.1)');
      break;
    case 'cool':
      parts.push('saturate(0.9)', 'hue-rotate(10deg)');
      break;
  }

  if (s.brightness !== 100) parts.push(`brightness(${s.brightness}%)`);
  if (s.contrast !== 100) parts.push(`contrast(${s.contrast}%)`);
  if (s.saturation !== 100) parts.push(`saturate(${s.saturation}%)`);

  return parts.length > 0 ? parts.join(' ') : 'none';
}
