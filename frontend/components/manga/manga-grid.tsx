import { MangaCard } from './manga-card';
import { MangaCardSkeleton } from './manga-card-skeleton';
import type { MangaListItem } from '@/types/manga.types';

const COLS = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

export function MangaGrid({
  items,
  isLoading,
  skeletonCount = 12,
}: {
  items: MangaListItem[];
  isLoading?: boolean;
  skeletonCount?: number;
}) {
  if (isLoading) {
    return (
      <div className={`grid ${COLS} gap-4 md:gap-6`}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <MangaCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className={`grid ${COLS} gap-4 md:gap-6`}>
      {items.map((m) => (
        <MangaCard key={m.id} manga={m} />
      ))}
    </div>
  );
}
