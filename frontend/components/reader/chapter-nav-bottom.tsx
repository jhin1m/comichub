import Link from 'next/link';
import { PixelButton } from '@pxlkit/ui-kit';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ChapterNavigation } from '@/types/manga.types';

interface Props {
  nav: ChapterNavigation | null;
  mangaSlug: string;
}

export function ChapterNavBottom({ nav, mangaSlug }: Props) {
  const hasPrev = !!nav?.prev;
  const hasNext = !!nav?.next;

  if (!hasPrev && !hasNext) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-12 max-w-[800px] mx-auto px-4">
      {hasPrev ? (
        <Link href={`/manga/${mangaSlug}/${nav!.prev!.id}`} className="flex-1 max-w-[240px]">
          <PixelButton tone="red" className="w-full flex items-center justify-center gap-2">
            <ChevronLeft size={18} />
            Ch. {nav!.prev!.number}
          </PixelButton>
        </Link>
      ) : (
        <div className="flex-1 max-w-[240px]" />
      )}

      {hasNext ? (
        <Link href={`/manga/${mangaSlug}/${nav!.next!.id}`} className="flex-1 max-w-[240px]">
          <PixelButton tone="red" className="w-full flex items-center justify-center gap-2">
            Ch. {nav!.next!.number}
            <ChevronRight size={18} />
          </PixelButton>
        </Link>
      ) : (
        <div className="flex-1 max-w-[240px]" />
      )}
    </div>
  );
}
