'use client';
import { useEffect, useState, use } from 'react';
import { chapterApi } from '@/lib/api/chapter.api';
import { userApi } from '@/lib/api/user.api';
import { useAuth } from '@/contexts/auth.context';
import { ReaderToolbar } from '@/components/reader/reader-toolbar';
import { ReaderImage } from '@/components/reader/reader-image';
import { ChapterNavBottom } from '@/components/reader/chapter-nav-bottom';
import { ReaderProgressBar } from '@/components/reader/reader-progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChapterWithImages, ChapterNavigation } from '@/types/manga.types';

interface Props {
  params: Promise<{ slug: string; chapterId: string }>;
}

export default function ChapterReaderPage({ params }: Props) {
  const { slug, chapterId } = use(params);
  const id = Number(chapterId);
  const { user } = useAuth();

  const [chapter, setChapter] = useState<ChapterWithImages | null>(null);
  const [nav, setNav] = useState<ChapterNavigation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setChapter(null);
    setNav(null);
    Promise.all([chapterApi.getWithImages(id), chapterApi.getNavigation(id)])
      .then(([ch, n]) => {
        setChapter(ch);
        setNav(n);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    if (chapter && user) {
      userApi.upsertHistory(chapter.mangaId, chapter.id).catch(() => {});
    }
  }, [chapter?.id, user?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center gap-2 pt-20">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="w-[800px] max-w-full h-[1000px]" />
        ))}
      </div>
    );
  }

  if (!chapter) return null;

  const sortedImages = [...chapter.images].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-black">
      <ReaderProgressBar />
      <ReaderToolbar chapter={chapter} nav={nav} mangaSlug={slug} />
      <div className="max-w-[800px] mx-auto">
        {sortedImages.map((img) => (
          <ReaderImage
            key={img.id}
            src={img.imageUrl}
            alt={`Page ${img.pageNumber}`}
          />
        ))}
      </div>
      <ChapterNavBottom nav={nav} mangaSlug={slug} />
    </div>
  );
}
