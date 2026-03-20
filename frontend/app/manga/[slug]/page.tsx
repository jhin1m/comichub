export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mangaApi } from '@/lib/api/manga.api';
import { MangaCoverHero } from '@/components/detail/manga-cover-hero';
import { MangaDescription } from '@/components/detail/manga-description';
import { MangaGenres } from '@/components/detail/manga-genres';
import { ChapterList } from '@/components/detail/chapter-list';
import { PixelTabs } from '@pxlkit/ui-kit';
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
          <PixelTabs
            items={[
              {
                id: 'chapters',
                label: 'Chapters',
                content: <ChapterList chapters={manga.chapters} mangaSlug={slug} />,
              },
              {
                id: 'about',
                label: 'About',
                content: (
                  <div className="space-y-4">
                    <MangaDescription description={manga.description} />
                    <MangaGenres genres={manga.genres} />
                  </div>
                ),
              },
            ]}
          />
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
