export const dynamic = 'force-dynamic';

import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mangaApi } from '@/lib/api/manga.api';
import { MangaCoverHero } from '@/components/detail/manga-cover-hero';
import { MangaSidebar } from '@/components/detail/manga-sidebar';
import { MobileDetailsBar } from '@/components/detail/mobile-details-bar';
import { ChapterList } from '@/components/detail/chapter-list';
import { SimilarManga } from '@/components/detail/similar-manga';
import PageWrapper from '@/components/layout/page-wrapper';

const getManga = cache((slug: string) => mangaApi.detail(slug));

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MangaDetailPage({ params }: Props) {
  const { slug } = await params;
  try {
    const manga = await getManga(slug);
    return (
      <PageWrapper className="py-8">
        {/* Top: cover+info left, rating+metadata right (desktop) */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 pb-8 border-b border-[#2a2a2a]">
          <div className="space-y-4">
            <MangaCoverHero manga={manga} />
            {/* Mobile: rating bar + collapsible metadata */}
            <MobileDetailsBar manga={manga} />
          </div>
          {/* Desktop sidebar: rating + metadata */}
          <div className="hidden lg:block">
            <MangaSidebar manga={manga} />
          </div>
        </section>

        {/* Bottom: chapter list left, recommendations right */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-8">
          <ChapterList chapters={manga.chapters} mangaSlug={slug} />
          <aside>
            <SimilarManga genres={manga.genres} currentMangaId={manga.id} />
          </aside>
        </section>
      </PageWrapper>
    );
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const manga = await getManga(slug);
    return {
      title: `${manga.title} - ComicHub`,
      description: manga.description?.slice(0, 160) ?? `Read ${manga.title} on ComicHub`,
    };
  } catch {
    return { title: 'Manga Not Found - ComicHub' };
  }
}
