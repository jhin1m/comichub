'use client';

import { useEffect } from 'react';

export interface ReaderKeyboardActions {
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleFullscreen: () => void;
  onExit: () => void;
}

/**
 * Handles essential reader keyboard shortcuts.
 * Disabled when focus is inside an input/textarea.
 */
export function useReaderKeyboard(actions: ReaderKeyboardActions, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          actions.onPrevChapter();
          break;
        case 'ArrowRight':
          e.preventDefault();
          actions.onNextChapter();
          break;
        case 'ArrowUp':
          e.preventDefault();
          actions.onPrevPage();
          break;
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          actions.onNextPage();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          actions.onToggleFullscreen();
          break;
        case 'Escape':
          actions.onExit();
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [actions, enabled]);
}
