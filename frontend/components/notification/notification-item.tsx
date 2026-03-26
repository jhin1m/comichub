'use client';

import Image from 'next/image';
import { ChatCircleIcon, HeartIcon, BookOpenIcon } from '@phosphor-icons/react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatRelativeDate } from '@/lib/utils';
import type { NotificationGroup } from '@/lib/notification-grouping';
import type {
  ChapterNotificationData,
  CommentReplyData,
  CommentLikeData,
} from '@/lib/notification-types';

interface NotificationItemProps {
  group: NotificationGroup;
  onClick: () => void;
}

export function NotificationItem({ group, onClick }: NotificationItemProps) {
  const first = group.notifications[0];

  if (group.type === 'chapter.created') {
    const data = first.data as ChapterNotificationData;
    const chapterNums = group.notifications
      .map((n) => `Ch.${(n.data as ChapterNotificationData).chapterNumber}`)
      .join(', ');
    const latestChapter = group.notifications.reduce((acc, n) => {
      const d = n.data as ChapterNotificationData;
      return d.chapterNumber > acc.chapterNumber ? d : acc;
    }, data);
    const href = `/manga/${latestChapter.mangaSlug}/chapter-${latestChapter.chapterNumber}`;

    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-hover',
          group.isUnread ? 'bg-hover/50' : 'bg-transparent',
        )}
      >
        <div className="relative shrink-0 w-8 h-11 rounded overflow-hidden bg-elevated">
          {data.mangaCover ? (
            <Image src={data.mangaCover} alt={data.mangaTitle} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              <BookOpenIcon size={16} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">{data.mangaTitle}</p>
          <p className="text-xs text-secondary truncate">
            {group.notifications.length > 1
              ? `${group.notifications.length} new chapters (${chapterNums})`
              : `New chapter ${chapterNums}`}
          </p>
          <p className="text-xs text-muted mt-0.5">{formatRelativeDate(group.latestAt)}</p>
        </div>
        {group.isUnread && (
          <span className="mt-1.5 shrink-0 w-2 h-2 bg-accent rounded-full" />
        )}
        {/* store href as data attr for parent to navigate */}
        <span className="sr-only">{href}</span>
      </button>
    );
  }

  if (group.type === 'comment.replied') {
    const data = first.data as CommentReplyData;
    const href = data.mangaSlug ? `/manga/${data.mangaSlug}#comment-${data.commentId}` : '#';

    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-hover',
          group.isUnread ? 'bg-hover/50' : 'bg-transparent',
        )}
      >
        <div className="relative shrink-0">
          <Avatar src={data.replyAuthorAvatar ?? undefined} fallback={data.replyAuthorName} size="sm" />
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-surface flex items-center justify-center">
            <ChatCircleIcon size={10} className="text-accent" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-secondary">
            <span className="font-semibold text-primary">{data.replyAuthorName}</span>
            {' replied to your comment'}
          </p>
          <p className="text-xs text-muted truncate mt-0.5">{data.replyContent}</p>
          <p className="text-xs text-muted mt-0.5">{formatRelativeDate(group.latestAt)}</p>
        </div>
        {group.isUnread && (
          <span className="mt-1.5 shrink-0 w-2 h-2 bg-accent rounded-full" />
        )}
        <span className="sr-only">{href}</span>
      </button>
    );
  }

  // comment.liked
  const data = first.data as CommentLikeData;
  const count = group.notifications.length;
  const href = data.mangaSlug ? `/manga/${data.mangaSlug}#comment-${data.commentId}` : '#';
  const likerLabel =
    count > 1 ? `${data.likerName} +${count - 1} others` : data.likerName;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-hover',
        group.isUnread ? 'bg-hover/50' : 'bg-transparent',
      )}
    >
      <div className="relative shrink-0">
        <Avatar src={data.likerAvatar ?? undefined} fallback={data.likerName} size="sm" />
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-surface flex items-center justify-center">
          <HeartIcon size={10} className="text-accent" weight="fill" />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-secondary">
          <span className="font-semibold text-primary">{likerLabel}</span>
          {' liked your comment'}
        </p>
        <p className="text-xs text-muted truncate mt-0.5">{data.commentPreview}</p>
        <p className="text-xs text-muted mt-0.5">{formatRelativeDate(group.latestAt)}</p>
      </div>
      {group.isUnread && (
        <span className="mt-1.5 shrink-0 w-2 h-2 bg-accent rounded-full" />
      )}
      <span className="sr-only">{href}</span>
    </button>
  );
}

export function getGroupHref(group: NotificationGroup): string {
  const first = group.notifications[0];
  if (group.type === 'chapter.created') {
    const items = group.notifications.map((n) => n.data as ChapterNotificationData);
    const latest = items.reduce((acc, d) => (d.chapterNumber > acc.chapterNumber ? d : acc), items[0]);
    return `/manga/${latest.mangaSlug}/chapter-${latest.chapterNumber}`;
  }
  if (group.type === 'comment.replied') {
    const data = first.data as CommentReplyData;
    return data.mangaSlug ? `/manga/${data.mangaSlug}#comment-${data.commentId}` : '#';
  }
  const data = first.data as CommentLikeData;
  return data.mangaSlug ? `/manga/${data.mangaSlug}#comment-${data.commentId}` : '#';
}
