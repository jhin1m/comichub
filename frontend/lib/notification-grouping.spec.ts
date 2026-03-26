import { describe, it, expect } from 'vitest';
import { groupNotifications } from './notification-grouping';
import type { NotificationItem, ChapterNotificationData, CommentLikeData, CommentReplyData } from './notification-types';

function makeChapter(id: string, mangaId: number, createdAt: string, readAt: string | null = null): NotificationItem {
  return {
    id,
    notifiableType: 'user',
    notifiableId: 1,
    type: 'chapter.created',
    data: {
      mangaId,
      mangaTitle: `Manga ${mangaId}`,
      mangaSlug: `manga-${mangaId}`,
      chapterId: parseInt(id),
      chapterNumber: 1,
      mangaCover: null,
    } as ChapterNotificationData,
    readAt,
    createdAt,
  };
}

function makeLike(id: string, commentId: number, createdAt: string, readAt: string | null = null): NotificationItem {
  return {
    id,
    notifiableType: 'user',
    notifiableId: 1,
    type: 'comment.liked',
    data: {
      commentId,
      likerName: 'Liker',
      likerAvatar: null,
      commentPreview: 'preview',
      mangaSlug: null,
    } as CommentLikeData,
    readAt,
    createdAt,
  };
}

function makeReply(id: string, commentId: number, createdAt: string, readAt: string | null = null): NotificationItem {
  return {
    id,
    notifiableType: 'user',
    notifiableId: 1,
    type: 'comment.replied',
    data: {
      commentId,
      replyAuthorName: 'Author',
      replyAuthorAvatar: null,
      replyContent: 'reply',
      mangaId: null,
      mangaSlug: null,
    } as CommentReplyData,
    readAt,
    createdAt,
  };
}

describe('groupNotifications', () => {
  it('returns empty array for empty input', () => {
    expect(groupNotifications([])).toEqual([]);
  });

  it('creates single group for single item', () => {
    const items = [makeChapter('1', 10, '2026-01-01T00:00:00Z')];
    const result = groupNotifications(items);
    expect(result).toHaveLength(1);
    expect(result[0].notifications).toHaveLength(1);
    expect(result[0].key).toBe('chapter:10');
  });

  it('groups 3 chapter notifications with same mangaId into one group', () => {
    const items = [
      makeChapter('1', 10, '2026-01-01T00:00:00Z'),
      makeChapter('2', 10, '2026-01-02T00:00:00Z'),
      makeChapter('3', 10, '2026-01-03T00:00:00Z'),
    ];
    const result = groupNotifications(items);
    expect(result).toHaveLength(1);
    expect(result[0].notifications).toHaveLength(3);
    expect(result[0].type).toBe('chapter.created');
  });

  it('keeps chapters with different mangaIds in separate groups', () => {
    const items = [
      makeChapter('1', 10, '2026-01-01T00:00:00Z'),
      makeChapter('2', 20, '2026-01-01T00:00:00Z'),
    ];
    const result = groupNotifications(items);
    expect(result).toHaveLength(2);
  });

  it('groups comment likes by commentId', () => {
    const items = [
      makeLike('1', 99, '2026-01-01T00:00:00Z'),
      makeLike('2', 99, '2026-01-02T00:00:00Z'),
    ];
    const result = groupNotifications(items);
    expect(result).toHaveLength(1);
    expect(result[0].notifications).toHaveLength(2);
    expect(result[0].key).toBe('like:99');
  });

  it('keeps comment replies ungrouped (keyed by notification id)', () => {
    const items = [
      makeReply('r1', 5, '2026-01-01T00:00:00Z'),
      makeReply('r2', 5, '2026-01-02T00:00:00Z'),
    ];
    const result = groupNotifications(items);
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.key)).toContain('reply:r1');
    expect(result.map((g) => g.key)).toContain('reply:r2');
  });

  it('sorts groups by latestAt descending', () => {
    const items = [
      makeChapter('1', 10, '2026-01-01T00:00:00Z'),
      makeChapter('2', 20, '2026-01-03T00:00:00Z'),
      makeChapter('3', 30, '2026-01-02T00:00:00Z'),
    ];
    const result = groupNotifications(items);
    expect(result[0].latestAt).toBe('2026-01-03T00:00:00Z');
    expect(result[1].latestAt).toBe('2026-01-02T00:00:00Z');
    expect(result[2].latestAt).toBe('2026-01-01T00:00:00Z');
  });

  it('updates latestAt to newest item in group', () => {
    const items = [
      makeChapter('1', 10, '2026-01-01T00:00:00Z'),
      makeChapter('2', 10, '2026-01-05T00:00:00Z'),
      makeChapter('3', 10, '2026-01-03T00:00:00Z'),
    ];
    const result = groupNotifications(items);
    expect(result[0].latestAt).toBe('2026-01-05T00:00:00Z');
  });

  it('sets isUnread true if any item is unread', () => {
    const items = [
      makeChapter('1', 10, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
      makeChapter('2', 10, '2026-01-02T00:00:00Z', null),
    ];
    const result = groupNotifications(items);
    expect(result[0].isUnread).toBe(true);
  });

  it('sets isUnread false when all items are read', () => {
    const items = [
      makeChapter('1', 10, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
      makeChapter('2', 10, '2026-01-02T00:00:00Z', '2026-01-03T00:00:00Z'),
    ];
    const result = groupNotifications(items);
    expect(result[0].isUnread).toBe(false);
  });
});
