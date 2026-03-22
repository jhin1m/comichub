'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChapterWithImages, ChapterNavigation } from '@/types/manga.types';

interface Props {
  chapter: ChapterWithImages;
  nav: ChapterNavigation | null;
  mangaSlug: string;
}

export function ReaderToolbar({ chapter, nav, mangaSlug }: Props) {
  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setVisible(y < lastYRef.current || y < 100);
      lastYRef.current = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-default transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-[800px] mx-auto">
        <div className="flex items-center gap-2">
          <Link href={`/manga/${mangaSlug}`}>
            <Button variant="secondary" size="sm" aria-label="Back to manga">
              <ChevronLeft size={18} />
            </Button>
          </Link>
          <span className="text-sm text-secondary truncate max-w-[200px]">
            Chapter {chapter.number}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {nav?.prev && (
            <Link href={`/manga/${mangaSlug}/${nav.prev.id}`}>
              <Button variant="secondary" size="sm" aria-label="Previous chapter">
                <ChevronLeft size={18} />
              </Button>
            </Link>
          )}
          {nav?.next && (
            <Link href={`/manga/${mangaSlug}/${nav.next.id}`}>
              <Button variant="secondary" size="sm" aria-label="Next chapter">
                <ChevronRight size={18} />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
