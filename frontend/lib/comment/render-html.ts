import DOMPurify from 'dompurify';

// Used by comment-item and revision-history-modal to render server-sanitized content.
// Strict whitelist mirrors backend sanitize.util — single source of truth.
const ALLOWED_TAGS = ['p', 'br', 'b', 'strong', 'i', 'em', 'blockquote', 'span', 'a', 'img'];
const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'class',
  'src',
  'alt',
  'data-type',
  'data-id',
  'data-label',
];

export function sanitizeCommentHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target'],
  });
}
