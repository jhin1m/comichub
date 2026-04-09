export interface MangaListItem {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  status: string;
  type: string;
  views: number;
  chaptersCount: number;
  latestChapterNumber: string | null;
  averageRating: string;
  updatedAt: Date;
  contentRating: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
  isHot: boolean;
}

export interface MangaDetail extends MangaListItem {
  altTitles: string[];
  description: string | null;
  originalLanguage: string | null;
  followersCount: number;
  totalRatings: number;
  year: number | null;
  chapterUpdatedAt: Date | null;
  genres: { id: number; name: string; slug: string }[];
  artists: { id: number; name: string; slug: string }[];
  authors: { id: number; name: string; slug: string }[];
  groups: { id: number; name: string; slug: string }[];
  chapters: ChapterListItem[];
  createdAt: Date;
}

export interface ChapterListItem {
  id: number;
  number: string;
  title: string | null;
  slug: string;
  language: string;
  volume: string | null;
  viewCount: number;
  order: number;
  createdAt: Date;
  groups: { id: number; name: string; slug: string }[];
}

export interface ChapterWithImages extends ChapterListItem {
  mangaId: number;
  mangaTitle: string;
  contentRating: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
  images: { id: number; imageUrl: string; pageNumber: number; order: number; groupId: number | null }[];
}

export interface ChapterNavigation {
  prev: { id: number; number: string; slug: string } | null;
  next: { id: number; number: string; slug: string } | null;
}

export interface TaxonomyItem {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
