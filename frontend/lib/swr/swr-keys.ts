// Central SWR key registry. Always import from here — never hardcode URLs as
// SWR keys. Prevents typos and makes invalidation sites easy to grep.

import type { CommentSort } from '@/types/comment.types';

export const HOMEPAGE_STRIP_LIMIT = 12;

export const SWR_KEYS = {
  AUTH_ME: '/auth/me',
  USER_HISTORY_STRIP: `/users/me/history?page=1&limit=${HOMEPAGE_STRIP_LIMIT}`,
  USER_BOOKMARK_STRIP: `/bookmarks?page=1&limit=${HOMEPAGE_STRIP_LIMIT}&sortBy=updated&sortOrder=desc`,
  // GET /notifications/unread-count → { count: number }
  // Single source of truth for navbar badge. Mutated by SSE handler and
  // mark-read actions in the dropdown so all consumers stay in sync.
  NOTIFICATIONS_UNREAD_COUNT: '/notifications/unread-count',
} as const;

// Comment list key — the URL itself is the SWR key, so the default fetcher
// (apiClient.get) resolves it without a custom function.
export const commentListKey = (
  type: 'manga' | 'chapter',
  id: number,
  page: number,
  limit: number,
  sort: CommentSort,
): string =>
  `/${type === 'manga' ? 'manga' : 'chapters'}/${id}/comments?page=${page}&limit=${limit}&sort=${sort}`;
