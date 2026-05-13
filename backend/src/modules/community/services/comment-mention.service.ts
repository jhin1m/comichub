import { Injectable } from '@nestjs/common';
import { UserService } from '../../user/services/user.service.js';

const MAX_MENTIONS = 5;

// Patterns declared per call (not module-scope) — `g` regex `lastIndex` would otherwise leak across
// concurrent requests in the same Node process and produce intermittent missed matches.
const MENTION_RE_A_SRC =
  '<span[^>]*data-type=["\']mention["\'][^>]*data-id=["\'](\\d+)["\'][^>]*>';
const MENTION_RE_B_SRC =
  '<span[^>]*data-id=["\'](\\d+)["\'][^>]*data-type=["\']mention["\'][^>]*>';

@Injectable()
export class CommentMentionService {
  constructor(private readonly userService: UserService) {}

  /**
   * Extract user IDs from <span data-type="mention" data-id="<id>"> markup.
   * IDs must be numeric (matches our serial PK). Returns deduped array preserving order.
   */
  parseMentionIds(html: string): number[] {
    if (!html) return [];
    const ids = new Set<number>();
    for (const src of [MENTION_RE_A_SRC, MENTION_RE_B_SRC]) {
      // Local regex instance per call — safe for concurrent execution.
      for (const m of html.matchAll(new RegExp(src, 'gi'))) {
        const id = parseInt(m[1], 10);
        if (Number.isFinite(id) && id > 0) ids.add(id);
      }
    }
    return [...ids];
  }

  /**
   * Validate mention IDs: drop invalid/deleted/self, cap at MAX_MENTIONS.
   * Single DB roundtrip via inArray.
   */
  async validateMentions(
    rawIds: number[],
    authorId: number | null,
  ): Promise<number[]> {
    if (rawIds.length === 0) return [];
    const filtered = rawIds
      .filter((id) => id !== authorId)
      .slice(0, MAX_MENTIONS);
    if (filtered.length === 0) return [];
    const existing = await this.userService.findExistingByIds(filtered);
    // Preserve original order; intersect with existing.
    const existsSet = new Set(existing);
    return filtered.filter((id) => existsSet.has(id));
  }

  /**
   * One-shot helper: parse + validate from sanitized HTML.
   */
  async parseAndValidate(html: string, authorId: number | null): Promise<number[]> {
    const ids = this.parseMentionIds(html);
    return this.validateMentions(ids, authorId);
  }
}
