'use client';

import { useEffect, useState } from 'react';
import type { ProgressPosition } from '@/hooks/use-reader-settings';

interface Props {
  position?: ProgressPosition;
  scrollRef?: React.RefObject<HTMLElement | null>;
}

export function ReaderProgressBar({ position = 'left', scrollRef }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const target = scrollRef?.current;

    const handleScroll = () => {
      if (target) {
        const { scrollTop, scrollHeight, clientHeight } = target;
        const total = scrollHeight - clientHeight;
        setProgress(total > 0 ? (scrollTop / total) * 100 : 0);
      } else {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        const total = scrollHeight - clientHeight;
        setProgress(total > 0 ? (scrollTop / total) * 100 : 0);
      }
    };

    const el = target ?? window;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollRef]);

  if (position === 'none') return null;

  const isVertical = position === 'left' || position === 'right';

  const positionClasses: Record<string, string> = {
    top: 'top-0 left-0 right-0 h-[3px]',
    bottom: 'bottom-0 left-0 right-0 h-[3px]',
    left: 'top-0 left-0 bottom-0 w-[3px]',
    right: 'top-0 right-0 bottom-0 w-[3px]',
  };

  return (
    <div className={`fixed z-[60] bg-accent/30 ${positionClasses[position]}`}>
      <div
        className="bg-accent transition-all duration-100"
        style={
          isVertical
            ? { width: '100%', height: `${progress}%` }
            : { height: '100%', width: `${progress}%` }
        }
      />
    </div>
  );
}
