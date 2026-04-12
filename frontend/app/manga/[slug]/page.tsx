export const revalidate = 180;

import { cache } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { mangaApi } from '@/lib/api/manga.api';
import { commentApi } from '@/lib/api/comment.api';
import { buildMeta, JsonLd, buildMangaJsonLd, buildBreadcrumbJsonLd, SITE_URL, SITE_NAME } from '@/lib/seo';
import { getMangaUrl } from '@/lib/utils/manga-url';
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
    // Parallel fetch — comment count is non-critical, default to 0
    const commentCount = await commentApi
      .listForManga(manga.id, { limit: 1 })
      .then((c) => c.total)
      .catch(() => 0);
    return (
      <>
        <JsonLd data={buildMangaJsonLd(manga)} />
        <JsonLd data={buildBreadcrumbJsonLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Browse', url: `${SITE_URL}/browse` },
          { name: manga.title, url: `${SITE_URL}${getMangaUrl(manga)}` },
        ])} />
        {/* ===== HERO SECTION — full-width blurred backdrop ===== */}
        <section className="relative overflow-hidden border-b border-default">
          {/* Blurred cover background + accent gradients */}
          <div className="absolute inset-0" aria-hidden="true">
            {manga.cover && (
              <Image
                src={manga.cover}
                alt=""
                fill
                className="object-cover blur-3xl scale-125 opacity-20"
                sizes="100vw"
                quality={10}
                priority
              />
            )}
            {/* Base overlay gradients */}
            <div className="absolute inset-0 bg-linear-to-r from-base via-base/95 to-base/80" />
            <div className="absolute inset-0 bg-linear-to-t from-base via-transparent to-base/60" />
            {/* Accent color glow — top-right warm, bottom-left cool */}
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent/[0.06] blur-3xl" />
            <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-info/[0.04] blur-3xl" />
          </div>

          {/* Hero content */}
          <div className="relative z-10 max-w-350 mx-auto px-4 py-8 md:py-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
              <div className="space-y-4 min-w-0">
                <MangaCoverHero manga={manga} commentCount={commentCount} />
                <MobileDetailsBar manga={manga} />
              </div>
              <div className="hidden lg:block min-w-0">
                <MangaSidebar manga={manga} />
              </div>
            </div>
          </div>
        </section>

        {/* ===== BELOW HERO — chapters, comments, sidebar ===== */}
        <main className="max-w-350 mx-auto px-4 py-8">
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-8 min-w-0">
              <ChapterList chapters={manga.chapters} mangaSlug={slug} mangaId={manga.id} />
              <CommentSection commentableType="manga" commentableId={manga.id} />
            </div>
            <aside className="min-w-0">
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
    return buildMeta({
      title: manga.title,
      description: manga.description?.replace(/<[^>]*>/g, '').slice(0, 160) ?? `Read ${manga.title} online on ${SITE_NAME}`,
      path: `/manga/${slug}`,
      image: manga.cover,
    });
  } catch {
    return { title: 'Manga Not Found' };
  }
}
