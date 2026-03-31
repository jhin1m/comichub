/**
 * Shared content-rating normalizer used by import adapters and scripts.
 */
export type ContentRating = 'safe' | 'suggestive' | 'erotica' | 'pornographic';

const VALID_RATINGS = new Set<ContentRating>([
  'safe',
  'suggestive',
  'erotica',
  'pornographic',
]);

/** Canonical default when no content rating is provided. */
export const DEFAULT_CONTENT_RATING: ContentRating = 'suggestive';

/** Normalize any external content rating string to a valid enum value. */
export function normalizeContentRating(
  value: string | undefined | null,
): ContentRating {
  if (!value) return DEFAULT_CONTENT_RATING;
  const lower = value.trim().toLowerCase() as ContentRating;
  return VALID_RATINGS.has(lower) ? lower : DEFAULT_CONTENT_RATING;
}

/** Convert a boolean NSFW flag to a content rating (for legacy Comix imports). */
export function nsfwToContentRating(isNsfw: boolean): ContentRating {
  return isNsfw ? 'erotica' : 'safe';
}

/** Ratings considered NSFW for filtering purposes. */
export const NSFW_RATINGS: ContentRating[] = ['erotica', 'pornographic'];
