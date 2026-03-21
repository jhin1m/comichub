export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mangaApi } from '@/lib/api/manga.api';
import { MangaCoverHero } from '@/components/detail/manga-cover-hero';
import { MangaTabs } from '@/components/detail/manga-tabs';
import PageWrapper from '@/components/layout/page-wrapper';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MangaDetailPage({ params }: Props) {
  const { slug } = await params;
  try {
    const manga = await mangaApi.detail(slug);
    return (
      <main>
        <MangaCoverHero manga={manga} />
        <PageWrapper className="py-8">
          <MangaTabs manga={manga} slug={slug} />
        </PageWrapper>
      </main>
    );
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const manga = await mangaApi.detail(slug);
    return {
      title: `${manga.title} — ComicHub`,
      description: manga.description ?? undefined,
    };
  } catch {
    return { title: 'Manga — ComicHub' };
  }
}
