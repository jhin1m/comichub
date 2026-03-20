export type MangaStatus = 'ongoing' | 'completed' | 'hiatus' | 'dropped';
export type MangaType = 'manga' | 'manhwa' | 'manhua' | 'doujinshi';

export interface MangaListItem {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  status: MangaStatus;
  type: MangaType;
  views: number;
  chaptersCount: number;
  averageRating: string;
  updatedAt: string;
}

export interface MangaDetail extends MangaListItem {
  titleAlt: string | null;
  description: string | null;
  followersCount: number;
  totalRatings: number;
  isHot: boolean;
  genres: TaxonomyItem[];
  artists: TaxonomyItem[];
  authors: TaxonomyItem[];
  groups: TaxonomyItem[];
  chapters: ChapterListItem[];
  createdAt: string;
}

export interface ChapterListItem {
  id: number;
  number: string;
  title: string | null;
  slug: string;
  viewCount: number;
  order: number;
  createdAt: string;
}

export interface ChapterWithImages extends ChapterListItem {
  mangaId: number;
  images: ChapterImage[];
}

export interface ChapterImage {
  id: number;
  imageUrl: string;
  pageNumber: number;
  order: number;
}

export interface ChapterNavigation {
  prev: { id: number; number: string; slug: string } | null;
  next: { id: number; number: string; slug: string } | null;
}

export interface TaxonomyItem {
  id: number;
  name: string;
  slug: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface MangaQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  genre?: string;
  status?: MangaStatus;
  type?: MangaType;
  sort?: 'views' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}
