'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PixelButton } from '@pxlkit/ui-kit';
import type { ChapterWithImages, ChapterNavigation } from '@/types/manga.types';

interface Props {
  chapter: ChapterWithImages;
  nav: ChapterNavigation | null;
  mangaSlug: string;
}

export function ReaderToolbar({ chapter, nav, mangaSlug }: Props) {
  const [visible, setVisible] = useState(true);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setVisible(y < lastY || y < 100);
      setLastY(y);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastY]);

  return (
    <div
      className={`sticky top-0 z-50 bg-black/90 backdrop-blur border-b border-[#2a2a2a] transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-[800px] mx-auto">
        <div className="flex items-center gap-2">
          <Link href={`/manga/${mangaSlug}`}>
            <PixelButton tone="neutral" size="sm" aria-label="Back to manga">
              <ChevronLeft size={16} />
            </PixelButton>
          </Link>
          <span className="text-sm text-[#a0a0a0] truncate max-w-[200px]">
            Chapter {chapter.number}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {nav?.prev && (
            <Link href={`/manga/${mangaSlug}/${nav.prev.id}`}>
              <PixelButton tone="neutral" size="sm" aria-label="Previous chapter">
                <ChevronLeft size={16} />
              </PixelButton>
            </Link>
          )}
          {nav?.next && (
            <Link href={`/manga/${mangaSlug}/${nav.next.id}`}>
              <PixelButton tone="neutral" size="sm" aria-label="Next chapter">
                <ChevronRight size={16} />
              </PixelButton>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
