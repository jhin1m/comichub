/**
 * Strip HTML tags and collapse whitespace. Used to extract plain text
 * for OpenAI moderation input — sending raw HTML wastes tokens and
 * may confuse the classifier with markup.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
