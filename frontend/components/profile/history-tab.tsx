import Image from 'next/image';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { formatRelativeDate } from '@/lib/utils';
import type { HistoryItem } from '@/types/user.types';

interface HistoryTabProps {
  items: HistoryItem[];
}

export function HistoryTab({ items }: HistoryTabProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock size={48} className="text-muted mb-4" />
        <p className="text-secondary text-sm mb-2">No history yet</p>
        <p className="text-muted text-xs">Start reading to track your progress</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/manga/${item.manga.slug}`}
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
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-sm font-semibold text-primary line-clamp-2 leading-tight">
              {item.manga.title}
            </p>
            {item.chapter && (
              <p className="text-xs text-secondary">Ch. {item.chapter.number}</p>
            )}
            <p className="text-xs text-muted">{formatRelativeDate(item.lastReadAt)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
