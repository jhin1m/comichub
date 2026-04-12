const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = CHARS.length; // 62

/** Encode a positive integer to a Base62 string */
export function encodeId(id: number): string {
  if (id <= 0) return '0';
  let result = '';
  let n = id;
  while (n > 0) {
    result = CHARS[n % BASE] + result;
    n = Math.floor(n / BASE);
  }
  return result;
}

/** Decode a Base62 string back to an integer. Returns null for invalid input. */
export function decodeId(code: string): number | null {
  if (!code || code.length > 8) return null;
  let result = 0;
  for (const ch of code) {
    const idx = CHARS.indexOf(ch);
    if (idx === -1) return null;
    result = result * BASE + idx;
  }
  return result > 0 ? result : null;
}

// Max shortId length for realistic PK ranges. 5 chars covers 62^5 = ~916M IDs.
// Prefixes longer than this are almost certainly slug words, not encoded IDs.
const MAX_SHORT_ID_LEN = 5;

/** Parse a URL identifier: try extracting shortId from `{shortId}-{slug}`, fall back to raw slug */
export function parseIdentifier(
  param: string,
): { type: 'id'; value: number } | { type: 'slug'; value: string } {
  const dashIdx = param.indexOf('-');
  if (dashIdx > 0 && dashIdx <= MAX_SHORT_ID_LEN) {
    const prefix = param.slice(0, dashIdx);
    const decoded = decodeId(prefix);
    if (decoded !== null) return { type: 'id', value: decoded };
  }
  // No dash or decode failed — try raw decode (bare shortId without slug)
  if (param.length <= MAX_SHORT_ID_LEN) {
    const decoded = decodeId(param);
    if (decoded !== null) return { type: 'id', value: decoded };
  }
  // Legacy slug
  return { type: 'slug', value: param };
}
