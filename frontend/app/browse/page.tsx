import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mangaApi } from '@/lib/api/manga.api';
import { getPreferencesFromCookies, buildPreferenceParams } from '@/lib/preferences-cookie';
import { BrowseContent } from '@/components/browse/browse-content';
import type { MangaQueryParams } from '@/types/manga.types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Browse - ComicHub',
  description: 'Browse and discover manga, manhwa, and manhua on ComicHub',
};

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function BrowsePage({ searchParams }: Props) {
  const sp = await searchParams;
  const prefs = await getPreferencesFromCookies();
  const prefParams = buildPreferenceParams(prefs);

  const params: MangaQueryParams = {
    page: Number(sp.page ?? 1),
    limit: 24,
    search: sp.search ?? undefined,
    genre: sp.genre ?? undefined,
    status: (sp.status as MangaQueryParams['status']) ?? undefined,
    type: (sp.type as MangaQueryParams['type']) ?? undefined,
    sort: (sp.sort as MangaQueryParams['sort']) ?? 'updated_at',
    order: 'desc',
    artist: sp.artist ? Number(sp.artist) : undefined,
    author: sp.author ? Number(sp.author) : undefined,
    includeGenres: sp.includeGenres ?? sp.genre ?? undefined,
    excludeGenres: sp.excludeGenres ?? prefParams.excludeGenres ?? undefined,
    demographic: sp.demographic ?? undefined,
    yearFrom: sp.yearFrom ? Number(sp.yearFrom) : undefined,
    yearTo: sp.yearTo ? Number(sp.yearTo) : undefined,
    minChapter: sp.minChapter ? Number(sp.minChapter) : undefined,
    minRating: sp.minRating ? Number(sp.minRating) : undefined,
    nsfw: sp.nsfw === 'true' ? true : prefParams.nsfw,
    excludeTypes: prefParams.excludeTypes,
    excludeDemographics: prefParams.excludeDemographics,
  };

  try {
    const result = await mangaApi.list(params);
    return <BrowseContent initialResult={result} initialParams={params} />;
  } catch {
    notFound();
  }
}
