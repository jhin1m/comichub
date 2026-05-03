'use client';

import { useEffect, useRef, type RefObject } from 'react';

interface Options {
  enableTap: boolean;
  enableSwipe: boolean;
  onTap?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

const TAP_MAX_MOVE = 10;
const TAP_MAX_DURATION = 250;
const SWIPE_MIN_DX = 50;

/**
 * Unified touch handler for reader: distinguishes tap vs swipe on the scroll
 * container. Tap = small movement + quick. Swipe = horizontal > 50px.
 * Skips when target is inside [data-reader-control] (bars/buttons).
 */
export function useReaderTapToggle(
  scrollRef: RefObject<HTMLElement | null>,
  { enableTap, enableSwipe, onTap, onSwipeLeft, onSwipeRight }: Options,
) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const target = scrollRef.current;
    if (!target) return;
    if (!enableTap && !enableSwipe) return;

    const onTouchStart = (e: TouchEvent) => {
      startRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: Date.now(),
      };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;

      const tgt = e.target as HTMLElement | null;
      if (tgt?.closest('[data-reader-control]')) return;

      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      const dt = Date.now() - start.t;

      if (enableSwipe && Math.abs(dx) > SWIPE_MIN_DX && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) onSwipeRight?.();
        else onSwipeLeft?.();
        return;
      }

      if (
        enableTap &&
        Math.abs(dx) < TAP_MAX_MOVE &&
        Math.abs(dy) < TAP_MAX_MOVE &&
        dt < TAP_MAX_DURATION
      ) {
        onTap?.();
      }
    };

    target.addEventListener('touchstart', onTouchStart, { passive: true });
    target.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      target.removeEventListener('touchstart', onTouchStart);
      target.removeEventListener('touchend', onTouchEnd);
    };
  }, [scrollRef, enableTap, enableSwipe, onTap, onSwipeLeft, onSwipeRight]);
}
