/**
 * Remove HTML tags from an untrusted string.
 *
 * The naive single-pass `.replace(/<[^>]*>/g, '')` is unsafe (CWE-116):
 * overlapping/nested tags like `<scrip<script>t>` collapse into a fresh
 * `<script>` after one pass. We iterate until no further reduction occurs,
 * then strip any stray `<` / `>` that cannot form a tag on their own.
 */
export function stripHtml(html: string): string {
  let previous: string;
  let current = html;
  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, '');
  } while (current !== previous);
  return current.replace(/[<>]/g, '');
}
