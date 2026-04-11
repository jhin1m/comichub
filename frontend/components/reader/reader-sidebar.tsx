'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/brand-logo';
import { useRouter } from 'next/navigation';
import { CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { CommentSection } from '@/components/comment/comment-section';
import { GroupPillSelector } from '@/components/reader/group-pill-selector';
import { chapterApi } from '@/lib/api/chapter.api';
import type { ChapterWithImages, ChapterNavigation, ChapterListItem } from '@/types/manga.types';

interface Props {
  chapter: ChapterWithImages;
  nav: ChapterNavigation | null;
  mangaSlug: string;
  mangaTitle: string;
  onClose: () => void;
  selectedGroupId: number | null;
  onGroupSelect: (groupId: number | null) => void;
}

export function ReaderSidebar({
  chapter, nav, mangaSlug, mangaTitle, onClose,
  selectedGroupId, onGroupSelect,
}: Props) {
  const router = useRouter();
  const [chapters, setChapters] = useState<ChapterListItem[]>([]);

  useEffect(() => {
    chapterApi.listByManga(chapter.mangaId).then(setChapters).catch(() => {});
  }, [chapter.mangaId]);

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chId = e.target.value;
    if (chId) router.push(`/manga/${mangaSlug}/${chId}`);
  };

  const sortedChapters = [...chapters].sort((a, b) => Number(b.number) - Number(a.number));

  return (
    <aside className="w-[70vw] md:w-[380px] min-w-0 md:min-w-[380px] h-full flex flex-col bg-surface border-l border-default">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-default">
        <Link href="/" className="shrink-0">
          <BrandLogo size="sm" />
        </Link>
        <button onClick={onClose} aria-label="Close sidebar" className="text-secondary hover:text-primary transition-colors p-1">
          <XIcon size={18} />
        </button>
      </div>

      {/* Manga title + chapter nav */}
      <div className="px-4 pt-3 pb-1">
        <Link href={`/manga/${mangaSlug}`} className="text-primary font-semibold text-sm hover:text-accent transition-colors line-clamp-1">
          {mangaTitle}
        </Link>
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        {nav?.prev ? (
          <Link href={`/manga/${mangaSlug}/${nav.prev.id}`}>
            <Button variant="secondary" size="sm" aria-label="Previous chapter" className="px-3"><CaretLeftIcon size={18} /></Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled className="px-3"><CaretLeftIcon size={18} /></Button>
        )}
        <select value={chapter.id} onChange={handleChapterChange} className="flex-1 h-9 bg-elevated border border-default rounded-md px-3 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-accent appearance-none cursor-pointer text-center">
          {sortedChapters.map((ch) => (
            <option key={ch.id} value={ch.id}>Ch {ch.number}</option>
          ))}
          {sortedChapters.length === 0 && <option value={chapter.id}>Ch {chapter.number}</option>}
        </select>
        {nav?.next ? (
          <Link href={`/manga/${mangaSlug}/${nav.next.id}`}>
            <Button variant="secondary" size="sm" aria-label="Next chapter" className="px-3"><CaretRightIcon size={18} /></Button>
          </Link>
        ) : (
          <Button variant="secondary" size="sm" disabled className="px-3"><CaretRightIcon size={18} /></Button>
        )}
      </div>

      {/* Group selector */}
      <GroupPillSelector groups={chapter.groups ?? []} selectedGroupId={selectedGroupId} onSelect={onGroupSelect} />

      {/* Comment section */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="text-xs text-warning bg-warning/10 rounded-md px-3 py-2 mb-3">
          Please read the <span className="underline cursor-pointer">comment rules</span> before posting.
        </div>
        <CommentSection commentableType="chapter" commentableId={chapter.id} />
      </div>
    </aside>
  );
}
