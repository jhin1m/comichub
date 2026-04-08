import { useState, useCallback, useEffect } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

/** Shared prev/next scroll state for Embla carousels */
export function useEmblaNav(emblaApi: EmblaCarouselType | undefined) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    emblaApi.on('select', onSelect).on('init', onSelect).on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect).off('init', onSelect).off('reInit', onSelect);
    };
  }, [emblaApi]);

  return { canPrev, canNext, scrollPrev, scrollNext };
}
