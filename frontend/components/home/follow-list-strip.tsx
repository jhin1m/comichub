'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon, HeartIcon, CaretRightIcon, CaretDownIcon, XIcon, SpinnerIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import type { BookmarkItem } from '@/types/bookmark.types';

const MAX_ITEMS = 6;

export function FollowListStrip() {
  const { user } = useAuth();
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('follow-list-hidden') === '1';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('follow-list-hidden', next ? '1' : '0');
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    bookmarkApi
      .getBookmarks({ page: 1, limit: MAX_ITEMS, sortBy: 'updated', sortOrder: 'desc' })
      .then((res: { data: BookmarkItem[] }) => setItems(res.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user]);

  const removeItem = async (e: React.MouseEvent, mangaId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (removing) return;
    setRemoving(mangaId);
    try {
      await bookmarkApi.removeBookmark(mangaId);
      setItems((prev) => prev.filter((item) => item.mangaId !== mangaId));
      toast.success('Removed from bookmarks');
    } catch {
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  if (!user || (loaded && items.length === 0)) return null;
  if (!loaded && collapsed) return null;

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
          <HeartIcon size={18} className="text-accent" />
          Follow List
          {collapsed
            ? <CaretRightIcon size={18} weight="bold" className="text-accent" />
            : <CaretDownIcon size={18} weight="bold" className="text-accent" />}
        </button>
        <Link
          href="/profile?tab=follows"
          className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
        >
          View All <ArrowRightIcon size={12} />
        </Link>
      </div>

      {/* Card strip — smooth collapse */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((entry) => (
              <Link
                key={entry.id}
                href={
                  entry.readingProgress?.currentChapterId
                    ? `/manga/${entry.manga.slug}/${entry.readingProgress.currentChapterId}`
                    : `/manga/${entry.manga.slug}`
                }
                className="group relative block rounded-lg bg-surface border border-default overflow-hidden hover:border-accent transition-colors"
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
                  {entry.readingProgress?.currentChapter && (
                    <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
                      Ch.{entry.readingProgress.currentChapter}
                    </span>
                  )}
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={(e) => removeItem(e, entry.mangaId)}
                    disabled={removing === entry.mangaId}
                    className="absolute bottom-1.5 right-1.5 z-10 flex items-center justify-center size-7 rounded-full bg-black/60 text-white/80 hover:bg-red-500/90 hover:text-white backdrop-blur-sm transition-all cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Remove from follow list"
                  >
                    {removing === entry.mangaId
                      ? <SpinnerIcon size={12} className="animate-spin" />
                      : <XIcon size={12} weight="bold" />}
                  </button>
                </div>

                {/* Info */}
                <div className="px-2.5 py-2">
                  <p className="text-[11px] text-secondary font-rajdhani mb-0.5">
                    {entry.readingProgress?.currentChapter ? `Ch.${entry.readingProgress.currentChapter}` : 'Not started'}
                  </p>
                  <p className="text-xs font-medium text-primary line-clamp-1 group-hover:text-accent transition-colors">
                    {entry.manga.title}
                  </p>
                  <p className="text-[10px] text-accent font-semibold mt-1">
                    {entry.readingProgress?.currentChapter ? 'Resume →' : 'Start →'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
