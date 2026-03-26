import { apiClient } from '@/lib/api-client';
import type { TaxonomyItem } from '@/types/manga.types';

export const authorApi = {
  list: () =>
    apiClient.get<TaxonomyItem[]>('/authors').then((r) => r.data),
  search: (q: string) =>
    apiClient.get<TaxonomyItem[]>('/authors', { params: { q } }).then((r) => r.data),
};
