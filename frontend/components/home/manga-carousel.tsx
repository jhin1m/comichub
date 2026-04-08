'use client';

import { useState, useEffect, useTransition } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { CaretLeftIcon, CaretRightIcon, FireIcon, HeartIcon } from '@phosphor-icons/react';
import type { Icon as IconType } from '@phosphor-icons/react';
import { MangaCard } from '@/components/manga/manga-card';
import { mangaApi, type RankingPeriod } from '@/lib/api/manga.api';
import { usePreferences } from '@/contexts/preferences.context';
import { useEmblaNav } from '@/hooks/use-embla-nav';
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
  const [rawItems, setRawItems] = useState(items);
  const [period, setPeriod] = useState<RankingPeriod | undefined>(defaultPeriod);
  const [isPending, startTransition] = useTransition();
  const { preferences } = usePreferences();

  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true });
  const { canPrev, canNext, scrollPrev, scrollNext } = useEmblaNav(emblaApi);

  // Filter by type preference
  const displayItems = rawItems.filter((item) => {
    if (preferences.excludedTypes.length > 0 && preferences.excludedTypes.includes(item.type)) return false;
    return true;
  });

  // Sync rawItems when server-side items change
  useEffect(() => { setRawItems(items); }, [items]);

  // Re-init embla when items change (period switch)
  useEffect(() => { emblaApi?.reInit(); }, [emblaApi, displayItems.length]);

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

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5 flex-wrap">
        <h2 className="font-rajdhani font-semibold text-2xl text-primary flex items-center gap-1.5">
          {Icon && <Icon size={18} className="text-accent" />}
          {title}
        </h2>

        {/* Period pill filters */}
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

      {/* Embla carousel */}
      {displayItems.length > 0 ? (
        <div
          className={`overflow-hidden transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
          ref={emblaRef}
        >
          <div className="flex gap-4">
            {displayItems.map((item, i) => (
              <div
                key={item.id}
                className="shrink-0 w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)]"
              >
                <MangaCard item={item} rank={showRank ? i + 1 : undefined} />
              </div>
            ))}
          </div>
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
