'use client';

import Link from 'next/link';
import {
  CaretRightIcon,
  StarIcon,
  HeartIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { ChapterNavigation } from '@/types/manga.types';

interface Props {
  chapterNumber: string;
  totalPages: number;
  nav: ChapterNavigation | null;
  mangaSlug: string;
}

/** Shown after the last page — engagement CTA for next chapter, rating, follow. */
export function ChapterEndScreen({ chapterNumber, totalPages, nav, mangaSlug }: Props) {
  const readingTime = Math.max(1, Math.round(totalPages * 0.5));

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12">
      <div className="bg-surface border border-default rounded-xl p-6 md:p-8 text-center">
        {/* Completion badge */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/15 text-success mb-4">
          <CheckCircleIcon size={28} weight="fill" />
        </div>

        <h3 className="font-rajdhani font-bold text-xl text-primary mb-1">
          Chapter {chapterNumber} Complete!
        </h3>

        <div className="flex items-center justify-center gap-1 text-xs text-muted mb-5">
          <ClockIcon size={12} />
          <span>~{readingTime} min read</span>
          <span className="mx-1">·</span>
          <span>{totalPages} pages</span>
        </div>

        {/* Primary CTA — next chapter */}
        {nav?.next && (
          <Link href={`/manga/${mangaSlug}/${nav.next.id}`} className="block mb-4">
            <Button variant="primary" className="w-full gap-2">
              Next: Chapter {nav.next.number}
              <CaretRightIcon size={16} />
            </Button>
          </Link>
        )}

        {/* Secondary actions */}
        <div className="flex gap-2">
          <Link href={`/manga/${mangaSlug}`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full gap-1.5">
              <StarIcon size={14} />
              Rate
            </Button>
          </Link>
          <Link href={`/manga/${mangaSlug}`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full gap-1.5">
              <HeartIcon size={14} />
              Follow
            </Button>
          </Link>
        </div>

        {!nav?.next && (
          <p className="text-xs text-muted mt-4">
            You&apos;re caught up! Check back later for new chapters.
          </p>
        )}
      </div>
    </div>
  );
}
