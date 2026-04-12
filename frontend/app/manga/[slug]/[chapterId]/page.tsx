export const dynamic = 'force-dynamic';

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { chapterApi } from '@/lib/api/chapter.api';
import { ChapterReader } from '@/components/reader/chapter-reader';
import { buildMeta, JsonLd, buildBreadcrumbJsonLd, SITE_URL, SITE_NAME } from '@/lib/seo';

interface Props {
  params: Promise<{ slug: string; chapterId: string }>;
}

const getChapter = cache((id: number) =>
  Promise.all([chapterApi.getWithImages(id), chapterApi.getNavigation(id)]),
);

export default async function ChapterReaderPage({ params }: Props) {
  const { slug, chapterId } = await params;
  const id = Number(chapterId);
  if (!Number.isFinite(id) || id <= 0) notFound();

  try {
    const [chapter, nav] = await getChapter(id);
    return (
      <>
        <JsonLd data={buildBreadcrumbJsonLd([
          { name: 'Home', url: SITE_URL },
          { name: chapter.mangaTitle, url: `${SITE_URL}/manga/${slug}` },
          { name: `Ch. ${chapter.number}`, url: `${SITE_URL}/manga/${slug}/${chapter.id}` },
        ])} />
        <ChapterReader
          chapter={chapter}
          nav={nav}
          slug={slug}
          mangaTitle={chapter.mangaTitle}
        />
      </>
    );
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, chapterId } = await params;
  const id = Number(chapterId);
  if (!Number.isFinite(id) || id <= 0) return { title: 'Chapter Not Found' };
  try {
    const [chapter] = await getChapter(id);
    return buildMeta({
      title: `Ch. ${chapter.number} - ${chapter.mangaTitle}`,
      description: `Read Chapter ${chapter.number} of ${chapter.mangaTitle} online on ${SITE_NAME}`,
      path: `/manga/${slug}/${chapterId}`,
    });
  } catch {
    return { title: 'Chapter Not Found' };
  }
}
