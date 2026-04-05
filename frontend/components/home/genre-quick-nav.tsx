'use client';

import { useRef } from 'react';
import Link from 'next/link';
import type { TaxonomyItem } from '@/types/manga.types';

interface Props {
  genres: TaxonomyItem[];
}

export function GenreQuickNav({ genres }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  /* Drag-to-scroll */
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);

  const pointerId = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    dragging.current = true;
    didDrag.current = false;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startScroll.current = el.scrollLeft;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const el = trackRef.current;
    if (!el) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 4) {
      didDrag.current = true;
      /* Capture only after confirming drag — lets simple clicks reach Link */
      if (pointerId.current !== null && !el.hasPointerCapture(pointerId.current)) {
        el.setPointerCapture(pointerId.current);
      }
    }
    if (didDrag.current) {
      el.scrollLeft = startScroll.current - delta;
    }
  };

  const onPointerUp = () => {
    dragging.current = false;
    const el = trackRef.current;
    if (el && pointerId.current !== null && el.hasPointerCapture(pointerId.current)) {
      el.releasePointerCapture(pointerId.current);
    }
    pointerId.current = null;
  };

  /* Block click on links if user was dragging */
  const onClickCapture = (e: React.MouseEvent) => {
    if (didDrag.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (genres.length === 0) return null;

  const visible = genres.slice(0, 15);

  return (
    <div className="border-b border-default bg-surface/50">
      <div className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 py-3">
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClickCapture={onClickCapture}
          className="flex gap-2 overflow-x-auto scrollbar-none items-center cursor-grab active:cursor-grabbing select-none"
        >
          <span className="font-mono text-[10px] tracking-widest uppercase text-muted shrink-0 mr-1">
            Genres
          </span>
          {visible.map((genre) => (
            <Link
              key={genre.id}
              href={`/browse?genre=${genre.slug}`}
              draggable={false}
              className="shrink-0 h-9 px-3.5 rounded-md border border-default bg-elevated text-secondary text-xs font-medium inline-flex items-center hover:border-accent hover:text-accent transition-colors"
            >
              {genre.name}
            </Link>
          ))}
          <Link
            href="/browse"
            draggable={false}
            className="shrink-0 h-9 px-3.5 rounded-md text-accent text-xs font-medium inline-flex items-center hover:bg-accent-muted transition-colors"
          >
            View All →
          </Link>
        </div>
      </div>
    </div>
  );
}
