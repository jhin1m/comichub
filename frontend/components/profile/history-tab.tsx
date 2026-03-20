import Image from 'next/image';
import Link from 'next/link';
import { formatRelativeDate } from '@/lib/utils';
import type { HistoryItem } from '@/types/user.types';

interface HistoryTabProps {
  items: HistoryItem[];
}

export function HistoryTab({ items }: HistoryTabProps) {
  if (items.length === 0) {
    return (
      <p className="text-center text-[#5a5a5a] py-12">No history yet</p>
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
          <div className="relative aspect-[2/3] rounded-[4px] overflow-hidden bg-surface border border-[#2a2a2a] transition-transform duration-150 ease-out group-hover:-translate-y-1 group-hover:border-accent">
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
              <div className="w-full h-full flex items-center justify-center text-[#5a5a5a] text-sm">
                No Cover
              </div>
            )}
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-sm font-semibold text-[#f5f5f5] line-clamp-2 leading-tight">
              {item.manga.title}
            </p>
            {item.chapter && (
              <p className="text-xs text-[#a0a0a0]">Ch. {item.chapter.number}</p>
            )}
            <p className="text-xs text-[#5a5a5a]">{formatRelativeDate(item.lastReadAt)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
