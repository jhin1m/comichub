// Central SWR key registry. Always import from here — never hardcode URLs as
// SWR keys. Prevents typos and makes invalidation sites easy to grep.

export const HOMEPAGE_STRIP_LIMIT = 12;

export const SWR_KEYS = {
  AUTH_ME: '/auth/me',
  USER_HISTORY_STRIP: `/users/me/history?page=1&limit=${HOMEPAGE_STRIP_LIMIT}`,
  USER_BOOKMARK_STRIP: `/bookmarks?page=1&limit=${HOMEPAGE_STRIP_LIMIT}&sortBy=updated&sortOrder=desc`,
} as const;
