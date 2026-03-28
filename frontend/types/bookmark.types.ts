export interface BookmarkFolder {
  id: number;
  name: string;
  slug: string;
  order: number;
  isDefault: boolean;
  count: number;
}

export interface BookmarkStatus {
  bookmarked: boolean;
  folderId: number | null;
  folderName: string | null;
  folderSlug: string | null;
}

export interface BookmarkResult {
  bookmarked: boolean;
  folderId?: number;
  followersCount: number;
}

export interface BookmarkItem {
  id: number;
  mangaId: number;
  manga: {
    id: number;
    title: string;
    slug: string;
    cover: string | null;
    status: string;
    chaptersCount: number;
    chapterUpdatedAt: string | null;
  };
  folder: {
    id: number;
    name: string;
    slug: string;
  };
  userRating: number | null;
  readingProgress: {
    currentChapter: string | null;
    currentChapterId: number | null;
    lastReadAt: string | null;
  } | null;
  createdAt: string;
}

export interface ImportPreviewEntry {
  title: string;
  malStatus: string;
  matchedManga: { id: number; title: string; slug: string } | null;
  confidence: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  notFound: number;
}
