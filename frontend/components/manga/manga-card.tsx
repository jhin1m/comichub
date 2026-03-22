'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { statusVariant } from '@/lib/utils';
import type { MangaListItem } from '@/types/manga.types';

export function MangaCard({ manga }: { manga: MangaListItem }) {
  return (
    <Link href={`/manga/${manga.slug}`} className="group block">
      <div className="relative aspect-2/3 rounded-sm overflow-hidden bg-surface border border-default transition-transform duration-150 ease-out group-hover:-translate-y-1 group-hover:border-accent">
        {manga.cover ? (
          <Image
            src={manga.cover}
            alt={manga.title}
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
          <Badge variant={statusVariant(manga.status)}>
            {manga.status}
          </Badge>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <p className="text-sm font-semibold text-primary line-clamp-2 leading-tight">
          {manga.title}
        </p>
        <p className="text-xs text-secondary">{manga.chaptersCount} ch</p>
      </div>
    </Link>
  );
}
