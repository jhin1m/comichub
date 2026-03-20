import { apiClient } from '@/lib/api-client';
import type { TaxonomyItem } from '@/types/manga.types';

export const genreApi = {
  list: () =>
    apiClient.get<TaxonomyItem[]>('/genres').then((r) => r.data),
};
