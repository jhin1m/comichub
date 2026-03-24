import { Eye, Users, Star } from '@phosphor-icons/react/ssr';
import { formatCount } from '@/lib/utils';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

export function MangaStats({ manga }: Props) {
  return (
    <div className="flex items-center gap-4 flex-wrap text-sm text-secondary">
      <span className="flex items-center gap-1">
        <Eye size={14} className="shrink-0" />
        {formatCount(manga.views)} views
      </span>
      <span className="flex items-center gap-1">
        <Users size={14} className="shrink-0" />
        {formatCount(manga.followersCount)} followers
      </span>
      <span className="flex items-center gap-1">
        <Star size={14} className="shrink-0" />
        {Number(manga.averageRating).toFixed(1)} ({manga.totalRatings})
      </span>
    </div>
  );
}
