export interface ExternalManga {
  externalId: string;
  title: string;
  altTitles: string[];
  description?: string;
  coverUrl?: string;
  originalLanguage?: string;
  status?: 'ongoing' | 'completed' | 'hiatus' | 'dropped' | 'cancelled';
  type?: 'manga' | 'manhwa' | 'manhua' | 'doujinshi';
  contentRating?: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
  demographic?: string;
  year?: number;
  genres: string[];
  themes: string[];
  authors: string[];
  artists: string[];
  links: ExternalLink[];
}

export interface ExternalLink {
  type: string;
  externalId?: string;
  url?: string;
}

export interface ExternalChapter {
  externalId: string;
  number: number;
  title?: string;
  volume?: string;
  language: string;
  publishedAt?: string;
  groups?: ExternalGroup[];
}

export interface ExternalGroup {
  externalId: string;
  name: string;
}

export interface ExternalChapterImage {
  url: string;
  pageNumber: number;
  width?: number;
  height?: number;
}

export interface ImportResult {
  mangaId: number;
  slug: string;
  created: boolean;
  chaptersImported?: number;
}

export interface SearchResult extends ExternalManga {
  alreadyImported: boolean;
  internalId?: number;
}
