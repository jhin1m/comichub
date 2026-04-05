'use client';

import { useState, useRef, useCallback, useEffect, useTransition } from 'react';
import { CaretLeftIcon, CaretRightIcon, FireIcon, HeartIcon } from '@phosphor-icons/react';
import type { Icon as IconType } from '@phosphor-icons/react';
import { MangaCard } from '@/components/manga/manga-card';
import { mangaApi, type RankingPeriod } from '@/lib/api/manga.api';
import { usePreferences } from '@/contexts/preferences.context';
import type { MangaListItem } from '@/types/manga.types';

const ICON_MAP: Record<string, IconType> = { flame: FireIcon, heart: HeartIcon };

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
  /** Enable period filter pills. Set to the initial ranking period. */
  defaultPeriod?: RankingPeriod;
}

export function MangaCarousel({ title, iconName, items = [], showRank = false, defaultPeriod }: Props) {
  const Icon = iconName ? ICON_MAP[iconName] : undefined;
  const trackRef = useRef<HTMLDivElement>(null);
  const [rawItems, setRawItems] = useState(items);
  const [period, setPeriod] = useState<RankingPeriod | undefined>(defaultPeriod);
  const [isPending, startTransition] = useTransition();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(items.length > 5);
  const { preferences } = usePreferences();

  // Filter by type preference (rankings don't include demographic/genre in list items)
  const displayItems = rawItems.filter((item) => {
    if (preferences.excludedTypes.length > 0 && preferences.excludedTypes.includes(item.type)) return false;
    return true;
  });

  const updateButtons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => { updateButtons(); }, [updateButtons]);

  // Sync rawItems when server-side items change
  useEffect(() => { setRawItems(items); }, [items]);

  function onPeriodChange(value: string) {
    const next = value as RankingPeriod;
    setPeriod(next);
    startTransition(async () => {
      try {
        const data = await mangaApi.rankings(next, 1, 10);
        setRawItems(data);
      } catch {
        // fetch failed — keep current data
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
    const gap = 16; // gap-4 = 1rem = 16px
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
      <div className="flex items-center gap-2 mb-3.5 flex-wrap">
        <h2 className="font-rajdhani font-semibold text-2xl text-primary flex items-center gap-1.5">
          {Icon && <Icon size={18} className="text-accent" />}
          {title}
        </h2>

        {/* Period pill filters — visible inline */}
        {defaultPeriod && (
          <div className="flex gap-1 ml-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onPeriodChange(opt.value)}
                disabled={isPending}
                className={`h-8 px-3 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                  period === opt.value
                    ? 'bg-accent text-white'
                    : 'border border-default text-secondary hover:border-muted hover:text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => scroll(-1)}
            disabled={!canPrev}
            className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-hover hover:enabled:text-primary transition-colors"
            aria-label="Previous"
          >
            <CaretLeftIcon size={13} />
          </button>
          <button
            onClick={() => scroll(1)}
            disabled={!canNext}
            className="w-7.5 h-7.5 flex items-center justify-center rounded-sm bg-elevated border border-default text-secondary disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-hover hover:enabled:text-primary transition-colors"
            aria-label="Next"
          >
            <CaretRightIcon size={13} />
          </button>
        </div>
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
          className={`flex gap-4 overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {displayItems.map((item, i) => (
            <div
              key={item.id}
              className="shrink-0 w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)]"
            >
              <MangaCard item={item} rank={showRank ? i + 1 : undefined} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {Icon ? <Icon size={48} className="text-muted mb-4" /> : <FireIcon size={48} className="text-muted mb-4" />}
          <p className="text-secondary text-sm">No data available</p>
        </div>
      )}
    </section>
  );
}
