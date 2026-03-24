'use client';

import { useState, useRef, useCallback, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flame, Heart, MoreHorizontal, type LucideIcon } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MangaCarouselCard } from './manga-carousel-card';
import { mangaApi, type RankingPeriod } from '@/lib/api/manga.api';
import type { MangaListItem } from '@/types/manga.types';

const ICON_MAP: Record<string, LucideIcon> = { flame: Flame, heart: Heart };

const PERIOD_OPTIONS: { value: RankingPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'alltime', label: 'All Time' },
];

interface Props {
  title: string;
  iconName?: string;
  items: MangaListItem[];
  showRank?: boolean;
  moreHref?: string;
  /** Enable period filter dropdown. Set to the initial ranking period. */
  defaultPeriod?: RankingPeriod;
}

export function MangaCarousel({ title, iconName, items = [], showRank = false, moreHref = '/browse', defaultPeriod }: Props) {
  const Icon = iconName ? ICON_MAP[iconName] : undefined;
  const trackRef = useRef<HTMLDivElement>(null);
  const [displayItems, setDisplayItems] = useState(items);
  const [period, setPeriod] = useState<RankingPeriod | undefined>(defaultPeriod);
  const [isPending, startTransition] = useTransition();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(items.length > 5);

  const updateButtons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => { updateButtons(); }, [updateButtons]);

  // Sync displayItems when server-side items change
  useEffect(() => { setDisplayItems(items); }, [items]);

  function onPeriodChange(value: string) {
    const next = value as RankingPeriod;
    setPeriod(next);
    startTransition(async () => {
      try {
        const data = await mangaApi.rankings(next, 1, 10);
        setDisplayItems(data);
      } catch (err) {
        console.error('Failed to fetch rankings:', err);
      }
    });
  }

  // Drag-to-scroll state
  const isPointerDown = useRef(false);
  const hasDragged = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const DRAG_THRESHOLD = 5; // px — movement below this counts as a click

  function scroll(dir: number) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.children[0] as HTMLElement | undefined;
    if (!card) return;
    const gap = 12; // gap-3 = 0.75rem = 12px
    el.scrollBy({ left: dir * 2 * (card.offsetWidth + gap), behavior: 'smooth' });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'touch') return; // let native touch scroll handle it
    const el = trackRef.current;
    if (!el) return;
    isPointerDown.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    scrollStart.current = el.scrollLeft;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isPointerDown.current) return;
    const delta = e.clientX - startX.current;
    if (!hasDragged.current && Math.abs(delta) < DRAG_THRESHOLD) return;
    hasDragged.current = true;
    const el = trackRef.current;
    if (!el) return;
    el.scrollLeft = scrollStart.current - delta;
  }

  function onPointerUp() {
    isPointerDown.current = false;
  }

  // Block click on links/cards when user was dragging
  function onClickCapture(e: React.MouseEvent) {
    if (hasDragged.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDragged.current = false;
    }
  }

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5">
        <h2 className="font-rajdhani font-bold text-[20px] text-primary flex-1 flex items-center gap-1.5">
          {Icon && <Icon size={18} className="text-accent" />}
          {title}
        </h2>

        <button
          onClick={() => scroll(-1)}
          disabled={!canPrev}
          className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-hover hover:enabled:text-primary transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={() => scroll(1)}
          disabled={!canNext}
          className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-secondary disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-hover hover:enabled:text-primary transition-colors"
          aria-label="Next"
        >
          <ChevronRight size={13} />
        </button>

        {defaultPeriod ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-secondary hover:bg-hover hover:text-primary transition-colors"
                aria-label="Filter period"
              >
                <MoreHorizontal size={13} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="bg-elevated border border-default rounded-md overflow-hidden z-50 shadow-lg min-w-[120px]"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <DropdownMenu.Item
                    key={opt.value}
                    onSelect={() => onPeriodChange(opt.value)}
                    className={`px-3 py-2 text-xs cursor-pointer outline-none select-none hover:bg-hover ${period === opt.value ? 'text-accent' : 'text-primary'}`}
                  >
                    {opt.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : (
          <Link
            href={moreHref}
            className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-secondary hover:bg-hover hover:text-primary transition-colors"
            aria-label="See all"
          >
            <MoreHorizontal size={13} />
          </Link>
        )}
      </div>

      {/* Scrollable card track — 2 cards per click, drag & touch enabled */}
      {displayItems.length > 0 ? (
        <div
          ref={trackRef}
          onScroll={updateButtons}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
          onDragStart={(e) => e.preventDefault()}
          className={`flex gap-3 overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {displayItems.map((item, i) => (
            <div
              key={item.id}
              className="shrink-0 w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.5rem)/3)] md:w-[calc((100%-2.25rem)/4)] lg:w-[calc((100%-3rem)/5)]"
            >
              <MangaCarouselCard item={item} rank={showRank ? i + 1 : undefined} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm py-8 text-center">No data available</p>
      )}
    </section>
  );
}
