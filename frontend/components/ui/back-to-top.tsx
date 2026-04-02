'use client';

import { useEffect, useState, type RefObject } from 'react';
import { ArrowUpIcon } from '@phosphor-icons/react';

const SCROLL_THRESHOLD = 300;

interface Props {
  /** When provided, listens to this container's scroll instead of window */
  scrollRef?: RefObject<HTMLElement | null>;
  className?: string;
}

export function BackToTop({ scrollRef, className = '' }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = scrollRef?.current;
    const el = target ?? window;

    const handleScroll = () => {
      const scrollTop = target ? target.scrollTop : window.scrollY;
      setVisible(scrollTop > SCROLL_THRESHOLD);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => el.removeEventListener('scroll', handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef?.current]);

  const scrollToTop = () => {
    const target = scrollRef?.current;
    if (target) {
      target.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`text-secondary hover:text-primary transition-all duration-300 p-2 bg-elevated/80 backdrop-blur-sm rounded-lg ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      } ${className}`}
    >
      <ArrowUpIcon size={18} />
    </button>
  );
}
