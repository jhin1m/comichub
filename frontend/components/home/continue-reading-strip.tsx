'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRightIcon, BookOpenIcon, CaretLeftIcon, CaretRightIcon, XIcon, SpinnerIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { userApi } from '@/lib/api/user.api';
import { useEmblaNav } from '@/hooks/use-embla-nav';
import type { HistoryItem } from '@/types/user.types';

const MAX_ITEMS = 12;

export function ContinueReadingStrip() {
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true });
  const { canPrev, canNext, scrollPrev, scrollNext } = useEmblaNav(emblaApi);

  useEffect(() => {
    if (!user) return;
    userApi
      .getHistory(1, MAX_ITEMS)
      .then((res) => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user]);

  const removeItem = async (e: React.MouseEvent, mangaId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (removing) return;
    setRemoving(mangaId);
    try {
      await userApi.removeHistory(mangaId);
      setItems((prev) => prev.filter((item) => item.mangaId !== mangaId));
      toast.success('Removed from history');
    } catch {
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  if (!user || (loaded && items.length === 0)) return null;

  /* Loading skeleton */
  if (!loaded) {
    return (
      <section className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 pt-6">
        <div className="h-6 w-48 bg-elevated rounded animate-pulse mb-3" />
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[140px] sm:w-[160px] rounded-lg bg-elevated animate-pulse aspect-2/3" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-rajdhani font-semibold text-xl text-primary flex items-center gap-1.5">
          <BookOpenIcon size={18} className="text-accent" />
          Continue Reading
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href="/profile?tab=history"
            className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
          >
            View History <ArrowRightIcon size={12} />
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

      {/* Embla carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {items.map((entry) => (
            <Link
              key={entry.id}
              href={entry.chapter ? `/manga/${entry.manga.slug}/${entry.chapter.id}` : `/manga/${entry.manga.slug}`}
              className="group relative shrink-0 w-[140px] sm:w-[160px] block rounded-lg overflow-hidden bg-elevated"
            >
              {/* Cover with overlay */}
              <div className="relative aspect-2/3">
                {entry.manga.cover ? (
                  <Image
                    src={entry.manga.cover}
                    alt={entry.manga.title}
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

                {/* Gradient overlay with info */}
                <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 flex flex-col justify-end">
                  <p className="text-[11px] text-white font-medium line-clamp-1 group-hover:text-accent transition-colors">
                    {entry.manga.title}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-white/60">
                      {entry.chapter ? `Ch.${entry.chapter.number}` : 'Not started'}
                    </p>
                    <p className="text-[10px] text-accent font-semibold">Resume →</p>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => removeItem(e, entry.mangaId)}
                  disabled={removing === entry.mangaId}
                  className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center size-6 rounded-full bg-black/60 text-white/80 hover:bg-red-500/90 hover:text-white backdrop-blur-sm transition-all cursor-pointer md:opacity-0 md:group-hover:opacity-100"
                  aria-label="Remove from history"
                >
                  {removing === entry.mangaId
                    ? <SpinnerIcon size={11} className="animate-spin" />
                    : <XIcon size={11} weight="bold" />}
                </button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
