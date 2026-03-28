export const dynamic = 'force-dynamic';

import { cache } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mangaApi } from '@/lib/api/manga.api';
import { MangaCoverHero } from '@/components/detail/manga-cover-hero';
import { MangaSidebar } from '@/components/detail/manga-sidebar';
import { MobileDetailsBar } from '@/components/detail/mobile-details-bar';
import { ChapterList } from '@/components/detail/chapter-list';
import { SimilarManga } from '@/components/detail/similar-manga';
import { CommentSection } from '@/components/comment/comment-section';

const getManga = cache((slug: string) => mangaApi.detail(slug));

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function MangaDetailPage({ params }: Props) {
  const { slug } = await params;
  try {
    const manga = await getManga(slug);
    return (
      <>
        {/* ===== HERO SECTION — full-width blurred backdrop ===== */}
        <section className="relative overflow-hidden border-b border-default">
          {/* Blurred cover background */}
          {manga.cover && (
            <div className="absolute inset-0" aria-hidden="true">
              <Image
                src={manga.cover}
                alt=""
                fill
                className="object-cover blur-3xl scale-125 opacity-20"
                sizes="100vw"
                quality={10}
                priority
              />
              <div className="absolute inset-0 bg-linear-to-r from-base via-base/95 to-base/80" />
              <div className="absolute inset-0 bg-linear-to-t from-base via-transparent to-base/60" />
            </div>
          )}

          {/* Hero content */}
          <div className="relative z-10 max-w-350 mx-auto px-4 py-8 md:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
              <div className="space-y-4">
                <MangaCoverHero manga={manga} />
                <MobileDetailsBar manga={manga} />
              </div>
              <div className="hidden lg:block">
                <MangaSidebar manga={manga} />
              </div>
            </div>
          </div>
        </section>

        {/* ===== BELOW HERO — chapters, comments, sidebar ===== */}
        <main className="max-w-350 mx-auto px-4 py-8">
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-8">
              <ChapterList chapters={manga.chapters} mangaSlug={slug} />
              <CommentSection commentableType="manga" commentableId={manga.id} />
            </div>
            <aside>
              <SimilarManga genres={manga.genres} currentMangaId={manga.id} />
            </aside>
          </section>
        </main>
      </>
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
