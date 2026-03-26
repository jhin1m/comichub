export interface MangaBakaCoverSize {
  url: string;
  width?: number;
  height?: number;
  blurhash?: string;
}

export interface MangaBakaSeries {
  id: number;
  title: string;
  native_title?: string;
  romanized_title?: string;
  secondary_titles?: Record<string, { type: string; title: string }[]>;
  cover?: {
    raw?: MangaBakaCoverSize;
    x150?: { url: string };
    x300?: { url: string };
  };
  authors?: string[];
  artists?: string[];
  description?: string;
  year?: number;
  status?: string;
  content_rating?: string;
  type?: string;
  rating?: number;
  genres?: string[];
  tags?: string[];
  genres_v2?: { id: number; name: string; group: string }[];
  tags_v2?: { id: number; name: string; group: string }[];
  links?: { url: string }[];
  source?: Record<string, { id: number; rating?: number }>;
}

export interface MangaBakaSearchResult {
  results: MangaBakaSeries[];
  total: number;
}
