'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, BookOpenIcon, CaretRightIcon, CaretDownIcon } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/auth.context';
import { userApi } from '@/lib/api/user.api';
import type { HistoryItem } from '@/types/user.types';

const MAX_ITEMS = 6;

export function ContinueReadingStrip() {
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('continue-reading-hidden') === '1';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('continue-reading-hidden', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    userApi
      .getHistory(1, MAX_ITEMS)
      .then((res) => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user]);

  // Don't render for guests or if no history
  if (!user || (loaded && items.length === 0)) return null;
  // Skip skeleton if user collapsed the section
  if (!loaded && collapsed) return null;
  // Loading skeleton
  if (!loaded) {
    return (
      <section className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 pt-6">
        <div className="h-6 w-48 bg-elevated rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: MAX_ITEMS }).map((_, i) => (
            <div key={i} className="rounded-lg bg-elevated animate-pulse aspect-2/3" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={toggleCollapsed}
          className="font-rajdhani font-semibold text-xl text-primary flex items-center gap-1.5 hover:text-accent transition-colors cursor-pointer"
        >
          <BookOpenIcon size={18} className="text-accent" />
          Continue Reading
          {collapsed
            ? <CaretRightIcon size={18} weight="bold" className="text-accent" />
            : <CaretDownIcon size={18} weight="bold" className="text-accent" />}
        </button>
        <Link
          href="/profile?tab=history"
          className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
        >
          View History <ArrowRightIcon size={12} />
        </Link>
      </div>

      {/* Card strip — smooth collapse via grid-rows trick */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((entry) => (
              <Link
                key={entry.id}
                href={entry.chapter ? `/manga/${entry.manga.slug}/${entry.chapter.id}` : `/manga/${entry.manga.slug}`}
                className="group block rounded-lg bg-surface border border-default overflow-hidden hover:border-accent transition-colors"
              >
                {/* Cover */}
                <div className="relative aspect-2/3 bg-elevated">
                  {entry.manga.cover ? (
                    <Image
                      src={entry.manga.cover}
                      alt={entry.manga.title}
                      fill
                      className="object-cover"
                      sizes="(max-width:640px) 45vw, (max-width:1024px) 22vw, 160px"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted text-[10px]">
                      No Cover
                    </div>
                  )}
                  {entry.chapter && (
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
                      Ch.{entry.chapter.number}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="px-2.5 py-2">
                  <p className="text-[11px] text-secondary font-rajdhani mb-0.5">
                    {entry.chapter ? `Ch.${entry.chapter.number}` : 'Not started'}
                  </p>
                  <p className="text-xs font-medium text-primary line-clamp-1 group-hover:text-accent transition-colors">
                    {entry.manga.title}
                  </p>
                  <p className="text-[10px] text-accent font-semibold mt-1">Resume →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
