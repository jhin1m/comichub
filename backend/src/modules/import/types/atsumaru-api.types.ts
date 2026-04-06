/* atsu.moe API response types — reverse-engineered from Tachiyomi extension */

// GET /api/infinite/trending, /api/infinite/recentlyUpdated
export interface AtsuBrowseResponse {
  items: AtsuManga[];
}

// POST /api/explore/filteredView
export interface AtsuSearchResponse {
  page: number;
  found: number;
  hits: AtsuSearchHit[];
}

export interface AtsuSearchHit {
  document: AtsuManga;
}

// GET /api/manga/page?id={slug}
export interface AtsuMangaPageResponse {
  mangaPage: AtsuManga;
}

export interface AtsuManga {
  id: string;
  title: string;
  poster?: string;
  image?: string;
  synopsis?: string;
  status?: string;
  type?: string;
  authors?: AtsuAuthor[];
  tags?: AtsuTag[];
  scanlators?: AtsuScanlator[];
}

export interface AtsuAuthor {
  name: string;
}

export interface AtsuTag {
  name: string;
}

export interface AtsuScanlator {
  id: string;
  name: string;
}

// GET /api/manga/allChapters?mangaId={slug}
export interface AtsuAllChaptersResponse {
  chapters: AtsuChapter[];
}

export interface AtsuChapter {
  id: string;
  number: number;
  title: string;
  scanlationMangaId?: string;
  createdAt?: string | number;
}

// GET /api/read/chapter?mangaId={slug}&chapterId={name}
export interface AtsuPageResponse {
  readChapter: AtsuReadChapter;
}

export interface AtsuReadChapter {
  pages: AtsuPage[];
}

export interface AtsuPage {
  image: string;
}

// POST body for /api/explore/filteredView
export interface AtsuSearchRequest {
  page: number;
  filter: AtsuSearchFilter;
}

export interface AtsuSearchFilter {
  search?: string;
  types?: string[];
  status?: string[];
  includedTags?: string[];
  year?: number;
  minChapters?: number;
  showAdult?: boolean;
  officialTranslation?: boolean;
  sortBy?: string;
}
