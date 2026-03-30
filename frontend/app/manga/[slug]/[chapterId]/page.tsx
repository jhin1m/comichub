export const dynamic = 'force-dynamic';

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { chapterApi } from '@/lib/api/chapter.api';
import { ChapterReader } from '@/components/reader/chapter-reader';

interface Props {
  params: Promise<{ slug: string; chapterId: string }>;
}

function formatSlugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const getChapter = cache((id: number) =>
  Promise.all([chapterApi.getWithImages(id), chapterApi.getNavigation(id)]),
);

export default async function ChapterReaderPage({ params }: Props) {
  const { slug, chapterId } = await params;
  const id = Number(chapterId);

  try {
    const [chapter, nav] = await getChapter(id);
    return (
      <ChapterReader
        chapter={chapter}
        nav={nav}
        slug={slug}
        mangaTitle={formatSlugToTitle(slug)}
      />
    );
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, chapterId } = await params;
  const id = Number(chapterId);
  try {
    const [chapter] = await getChapter(id);
    const title = formatSlugToTitle(slug);
    return {
      title: `Ch. ${chapter.number} - ${title} - ComicHub`,
    };
  } catch {
    return { title: 'Chapter Not Found - ComicHub' };
  }
}
