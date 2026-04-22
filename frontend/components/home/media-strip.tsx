'use client';

import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  XIcon,
  SpinnerIcon,
} from '@phosphor-icons/react';
import { useEmblaNav } from '@/hooks/use-embla-nav';

export interface MediaStripItem {
  id: number;
  mangaId: number;
  href: string;
  cover: string | null;
  title: string;
  subtitle: string; // "Ch.123" or "Not started"
  cta: string; // "Resume →" | "Start →"
}

interface MediaStripProps {
  title: string;
  icon: React.ReactNode;
  viewAllHref: string;
  viewAllLabel: string;
  removeAriaLabel: string;
  items: MediaStripItem[];
  removingId: number | null;
  onRemove: (mangaId: number) => void;
  testId?: string;
}

export function MediaStrip({
  title,
  icon,
  viewAllHref,
  viewAllLabel,
  removeAriaLabel,
  items,
  removingId,
  onRemove,
  testId,
}: MediaStripProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });
  const { canPrev, canNext, scrollPrev, scrollNext } = useEmblaNav(emblaApi);

  const handleRemove = (e: React.MouseEvent, mangaId: number) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(mangaId);
  };

  return (
    <section
      className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 pt-6"
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-rajdhani font-semibold text-xl text-primary flex items-center gap-1.5">
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href={viewAllHref}
            className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
          >
            {viewAllLabel} <ArrowRightIcon size={12} />
          </Link>
          <div className="flex gap-1">
            <button
              onClick={scrollPrev}
              disabled={!canPrev}
              className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-hover hover:enabled:text-primary transition-colors cursor-pointer"
              aria-label="Previous"
            >
              <CaretLeftIcon size={13} />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canNext}
              className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-secondary disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-hover hover:enabled:text-primary transition-colors cursor-pointer"
              aria-label="Next"
            >
              <CaretRightIcon size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {items.map((entry) => (
            <Link
              key={entry.id}
              href={entry.href}
              className="group relative shrink-0 w-[140px] sm:w-[160px] block rounded-lg overflow-hidden bg-elevated"
              data-testid="media-strip-item"
            >
              <div className="relative aspect-2/3">
                {entry.cover ? (
                  <Image
                    src={entry.cover}
                    alt={entry.title}
                    fill
                    className="object-cover"
                    sizes="160px"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">
                    No Cover
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 flex flex-col justify-end">
                  <p className="text-[11px] text-white font-medium line-clamp-1 group-hover:text-accent transition-colors">
                    {entry.title}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-white/60">{entry.subtitle}</p>
                    <p className="text-[10px] text-accent font-semibold">
                      {entry.cta}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleRemove(e, entry.mangaId)}
                  disabled={removingId === entry.mangaId}
                  className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center size-6 rounded-full bg-black/60 text-white/80 hover:bg-red-500/90 hover:text-white backdrop-blur-sm transition-all cursor-pointer md:opacity-0 md:group-hover:opacity-100"
                  aria-label={removeAriaLabel}
                >
                  {removingId === entry.mangaId ? (
                    <SpinnerIcon size={11} className="animate-spin" />
                  ) : (
                    <XIcon size={11} weight="bold" />
                  )}
                </button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MediaStripSkeleton() {
  return (
    <section
      className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 pt-6"
      data-testid="media-strip-skeleton"
    >
      <div className="h-6 w-48 bg-elevated rounded animate-pulse mb-3" />
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[140px] sm:w-[160px] rounded-lg bg-elevated animate-pulse aspect-2/3"
          />
        ))}
      </div>
    </section>
  );
}
