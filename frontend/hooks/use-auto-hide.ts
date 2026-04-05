'use client';

import { useEffect, useState, useRef, type RefObject } from 'react';

/**
 * Auto-hide header on scroll down, show on scroll up or when pointer enters top zone.
 * Returns `true` when the bar should be hidden.
 */
export function useAutoHide(scrollRef: RefObject<HTMLElement | null>, enabled = true) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }

    const target = scrollRef.current;
    if (!target) return;

    const handleScroll = () => {
      const currentY = target.scrollTop;
      const delta = currentY - lastScrollY.current;
      // Hide when scrolling down past 60px, show on scroll up
      if (delta > 5 && currentY > 60) {
        setHidden(true);
      } else if (delta < -5) {
        setHidden(false);
      }
      lastScrollY.current = currentY;
    };

    // Show bar when pointer enters the top 60px zone
    const handlePointerMove = (e: PointerEvent) => {
      if (e.clientY < 60) setHidden(false);
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      target.removeEventListener('scroll', handleScroll);
      document.removeEventListener('pointermove', handlePointerMove);
    };
  }, [scrollRef, enabled]);

  return hidden;
}
