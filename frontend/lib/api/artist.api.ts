import { apiClient } from '@/lib/api-client';
import type { TaxonomyItem } from '@/types/manga.types';

export const artistApi = {
  list: () =>
    apiClient.get<TaxonomyItem[]>('/artists').then((r) => r.data),
};
