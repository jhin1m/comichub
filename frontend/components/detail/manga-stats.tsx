import { Eye, Users, Star } from 'lucide-react';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function MangaStats({ manga }: Props) {
  return (
    <div className="flex items-center gap-4 flex-wrap text-sm text-[#a0a0a0]">
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
