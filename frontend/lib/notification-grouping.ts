import type { NotificationItem, ChapterNotificationData, CommentLikeData } from './notification-types';

export interface NotificationGroup {
  key: string;
  type: 'chapter.created' | 'comment.replied' | 'comment.liked';
  notifications: NotificationItem[];
  latestAt: string;
  isUnread: boolean;
}

export function groupNotifications(items: NotificationItem[]): NotificationGroup[] {
  const map = new Map<string, NotificationGroup>();

  for (const item of items) {
    const key = getGroupKey(item);
    const existing = map.get(key);
    if (existing) {
      existing.notifications.push(item);
      if (item.createdAt > existing.latestAt) existing.latestAt = item.createdAt;
      if (!item.readAt) existing.isUnread = true;
    } else {
      map.set(key, {
        key,
        type: item.type,
        notifications: [item],
        latestAt: item.createdAt,
        isUnread: !item.readAt,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );
}

function getGroupKey(item: NotificationItem): string {
  switch (item.type) {
    case 'chapter.created':
      return `chapter:${(item.data as ChapterNotificationData).mangaId}`;
    case 'comment.liked':
      return `like:${(item.data as CommentLikeData).commentId}`;
    case 'comment.replied':
      return `reply:${item.id}`;
  }
}
