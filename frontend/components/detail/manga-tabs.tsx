'use client';

import { PixelTabs } from '@pxlkit/ui-kit';
import { ChapterList } from './chapter-list';
import { MangaDescription } from './manga-description';
import { MangaGenres } from './manga-genres';
import type { MangaDetail } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
  slug: string;
}

export function MangaTabs({ manga, slug }: Props) {
  return (
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
  );
}
