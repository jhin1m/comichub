import Image from 'next/image';
import Link from 'next/link';
import { Heart } from '@phosphor-icons/react/ssr';
import { Badge } from '@/components/ui/badge';
import { statusVariant } from '@/lib/utils';
import { getMangaUrl } from '@/lib/utils/manga-url';
import type { FollowItem } from '@/types/user.types';

interface FollowsTabProps {
  items: FollowItem[];
}

export function FollowsTab({ items }: FollowsTabProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Heart size={48} className="text-muted mb-4" />
        <p className="text-secondary text-sm mb-2">No follows yet</p>
        <p className="text-muted text-xs">Follow manga to see them here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Link
          key={item.id}
          href={getMangaUrl(item.manga)}
          className="group block"
        >
          <div className="relative aspect-[2/3] rounded-[4px] overflow-hidden bg-surface border border-default transition-transform duration-150 ease-out group-hover:-translate-y-1 group-hover:border-accent">
            {item.manga.cover ? (
              <Image
                src={item.manga.cover}
                alt={item.manga.title}
                fill
                className="object-cover"
                sizes="(max-width:480px) 50vw,(max-width:768px) 33vw,200px"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                No Cover
              </div>
            )}
            <div className="absolute top-2 left-2">
              <Badge variant={statusVariant(item.manga.status)}>
                {item.manga.status}
              </Badge>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm font-semibold text-primary line-clamp-2 leading-tight">
              {item.manga.title}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
