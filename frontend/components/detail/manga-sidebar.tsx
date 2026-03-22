import StarRating from './star-rating';
import { MangaMetadata } from './manga-metadata';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

export function MangaSidebar({ manga }: Props) {
  return (
    <aside className="space-y-5">
      {/* Rating */}
      <StarRating
        mangaId={manga.id}
        averageRating={manga.averageRating}
        totalRatings={manga.totalRatings}
      />

      {/* Metadata — no card wrapper for visual consistency */}
      <MangaMetadata manga={manga} />
    </aside>
  );
}
