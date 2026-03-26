// Types matching the actual WeebDex API response shapes

export interface WeebDexSearchResponse {
  data: WeebDexManga[];
  total: number;
  limit: number;
  page: number;
}

export interface WeebDexManga {
  id: string;
  title: string;
  alt_titles?: Record<string, string[]>;
  description?: string;
  year?: number;
  language?: string; // original language: 'ja', 'ko', 'zh', etc.
  demographic?: string;
  status?: string;
  content_rating?: string;
  relationships?: {
    cover?: { id: string; ext: string; dimensions?: number[] };
    tags?: { id: string; group: string; name: string }[];
    authors?: { id: string; name: string }[];
    artists?: { id: string; name: string }[];
    links?: Record<string, string>;
  };
}

export interface WeebDexChapterResponse {
  data: WeebDexChapter[];
  total: number;
  limit: number;
  page: number;
}

export interface WeebDexChapter {
  id: string;
  title?: string;
  volume?: string;
  chapter?: string;
  language: string;
}
