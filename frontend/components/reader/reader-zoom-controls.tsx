'use client';

import type { RefObject } from 'react';
import { MinusIcon, PlusIcon, GearSixIcon } from '@phosphor-icons/react';
import { BackToTop } from '@/components/ui/back-to-top';

interface Props {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onSettingsClick: () => void;
  scrollRef?: RefObject<HTMLElement | null>;
  /** Hide zoom bar on mobile (bottom bar handles settings there). */
  isMobile?: boolean;
}

const ZOOM_STEP = 10;
const ZOOM_MIN = 30;
const ZOOM_MAX = 200;

export function ReaderZoomControls({ zoom, onZoomChange, onSettingsClick, scrollRef, isMobile }: Props) {
  const decrease = () => onZoomChange(Math.max(ZOOM_MIN, zoom - ZOOM_STEP));
  const increase = () => onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP));

  return (
    <div className="absolute bottom-4 left-0 right-0 flex items-end justify-between px-4 pointer-events-none z-40 md:bottom-4 bottom-18">
      {/* Zoom controls — desktop only */}
      {!isMobile && (
        <div className="pointer-events-auto flex items-center gap-1 bg-elevated/80 backdrop-blur-sm rounded-lg px-2 py-1.5">
          <button onClick={decrease} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out" className="text-secondary hover:text-primary disabled:opacity-40 transition-colors p-0.5">
            <MinusIcon size={14} />
          </button>
          <span className="text-xs text-secondary min-w-[36px] text-center tabular-nums">{zoom}%</span>
          <button onClick={increase} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in" className="text-secondary hover:text-primary disabled:opacity-40 transition-colors p-0.5">
            <PlusIcon size={14} />
          </button>
        </div>
      )}

      {/* Spacer when no zoom bar (mobile) */}
      {isMobile && <div />}

      {/* Back to top + Settings gear */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <BackToTop scrollRef={scrollRef} />
        {!isMobile && (
          <button
            onClick={onSettingsClick}
            aria-label="Reader settings"
            className="text-secondary hover:text-primary transition-colors p-2 bg-elevated/80 backdrop-blur-sm rounded-lg"
          >
            <GearSixIcon size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
