import { apiClient } from '@/lib/api-client';

export interface SuggestItem {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
}

export const searchApi = {
  suggest: (q: string) =>
    apiClient.get<SuggestItem[]>('/search/suggest', { params: { q } }).then((r) => r.data),
};
