'use client';

import { useEffect, useState, useRef, type RefObject } from 'react';

interface PageTrackerOptions {
  scrollRef: RefObject<HTMLElement | null>;
  totalPages: number;
  /** When true (single/double page modes), skip IntersectionObserver. */
  manualMode?: boolean;
}

/**
 * Tracks the currently visible page using IntersectionObserver (longstrip mode).
 * In manual mode (single/double), currentPage is set directly via setCurrentPage.
 */
export function usePageTracker({ scrollRef, totalPages, manualMode }: PageTrackerOptions) {
  const [currentPage, setCurrentPage] = useState(1);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Ensure refs array matches page count
  useEffect(() => {
    imageRefs.current = imageRefs.current.slice(0, totalPages);
  }, [totalPages]);

  // IntersectionObserver for longstrip mode
  useEffect(() => {
    if (manualMode || !scrollRef.current || totalPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex = -1;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            const idx = imageRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx >= 0) {
              bestIndex = idx;
              bestRatio = entry.intersectionRatio;
            }
          }
        }
        if (bestIndex >= 0) setCurrentPage(bestIndex + 1);
      },
      { root: scrollRef.current, threshold: [0.1, 0.3, 0.5, 0.7] },
    );

    for (const ref of imageRefs.current) {
      if (ref) observer.observe(ref);
    }

    return () => observer.disconnect();
  }, [scrollRef, totalPages, manualMode]);

  /** Assign to each image wrapper's ref callback. */
  const setImageRef = (index: number) => (el: HTMLDivElement | null) => {
    imageRefs.current[index] = el;
  };

  /** Jump to a specific page (scrolls into view in longstrip, sets state in manual). */
  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(clamped);
    if (!manualMode) {
      imageRefs.current[clamped - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return { currentPage, totalPages, setCurrentPage, setImageRef, goToPage, imageRefs };
}
