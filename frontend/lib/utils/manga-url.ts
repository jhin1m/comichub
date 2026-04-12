const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = CHARS.length;

function encodeId(id: number): string {
  if (id <= 0) return '0';
  let result = '';
  let n = id;
  while (n > 0) {
    result = CHARS[n % BASE]! + result;
    n = Math.floor(n / BASE);
  }
  return result;
}

/** Build manga detail URL: /manga/{shortId}-{slug} */
export function getMangaUrl(manga: { id: number; slug: string }): string {
  return `/manga/${encodeId(manga.id)}-${manga.slug}`;
}
