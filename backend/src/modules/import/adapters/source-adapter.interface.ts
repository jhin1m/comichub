import type {
  ExternalManga,
  ExternalChapter,
  ExternalChapterImage,
} from '../types/external-manga.types.js';

export interface SourceAdapter {
  readonly source: string;

  /** Search manga by title query */
  searchManga(query: string): Promise<ExternalManga[]>;

  /** Fetch full manga details by external ID */
  fetchManga(externalId: string): Promise<ExternalManga>;

  /** Fetch chapters for a manga (paginated) — optional */
  fetchChapters?(
    externalId: string,
    lang?: string,
    page?: number,
  ): Promise<ExternalChapter[]>;

  /** Fetch images for a specific chapter — optional */
  fetchChapterImages?(
    chapterExternalId: string,
  ): Promise<ExternalChapterImage[]>;
}
