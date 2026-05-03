'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import * as Popover from '@radix-ui/react-popover';
import { notificationApi } from '@/lib/api/notification.api';
import { groupNotifications } from '@/lib/notification-grouping';
import { NotificationItem, getGroupHref } from '@/components/notification/notification-item';
import { SWR_KEYS } from '@/lib/swr/swr-keys';
import type { NotificationGroup } from '@/lib/notification-grouping';

interface NotificationDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

type UnreadCountCache = { count: number } | undefined;

export function NotificationDropdown({
  open,
  onOpenChange,
  children,
}: NotificationDropdownProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await notificationApi.list({ limit: 20 });
      setGroups(groupNotifications(res.data));
      // List response carries the authoritative unreadCount from the DB —
      // sync the badge cache with it. revalidate=false because the list call
      // already supplies the truth and re-fetching `/unread-count` would just
      // duplicate work.
      mutate(
        SWR_KEYS.NOTIFICATIONS_UNREAD_COUNT,
        { count: res.unreadCount },
        false,
      );
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [mutate]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const handleMarkAllRead = async () => {
    // Optimistic: zero out badge immediately so the user sees instant feedback.
    mutate(SWR_KEYS.NOTIFICATIONS_UNREAD_COUNT, { count: 0 }, false);
    setGroups((prev) => prev.map((g) => ({ ...g, isUnread: false })));
    try {
      await notificationApi.markAllRead();
    } catch {
      // Server is the source of truth — revalidate to roll back if PATCH failed.
      mutate(SWR_KEYS.NOTIFICATIONS_UNREAD_COUNT);
    }
  };

  const handleItemClick = async (group: NotificationGroup) => {
    const href = getGroupHref(group);
    const unreadInGroup = group.notifications.filter((n) => !n.readAt).length;

    // Optimistic decrement. Updater fn (not literal) so rapid clicks compose
    // correctly against the latest cache rather than a stale closure.
    if (unreadInGroup > 0) {
      mutate(
        SWR_KEYS.NOTIFICATIONS_UNREAD_COUNT,
        (curr: UnreadCountCache) => ({
          count: Math.max(0, (curr?.count ?? 0) - unreadInGroup),
        }),
        false,
      );
    }
    setGroups((prev) =>
      prev.map((g) => (g.key === group.key ? { ...g, isUnread: false } : g)),
    );

    // Fire mark-read PATCHes in the background. We don't await — the user
    // already clicked through, so navigation should not wait on N round-trips.
    // If any call fails, revalidate from the server to recover the truth.
    Promise.allSettled(
      group.notifications
        .filter((n) => !n.readAt)
        .map((n) => notificationApi.markRead(n.id)),
    ).then((results) => {
      if (results.some((r) => r.status === 'rejected')) {
        mutate(SWR_KEYS.NOTIFICATIONS_UNREAD_COUNT);
      }
    });

    onOpenChange(false);
    router.push(href);
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 sm:w-96 bg-surface border border-default rounded-lg shadow-xl
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
            data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-default">
            <h3 className="font-rajdhani font-bold text-base">Notifications</h3>
            {groups.some((g) => g.isUnread) && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">No notifications yet</p>
            ) : (
              <ul>
                {groups.map((group) => (
                  <li key={group.key}>
                    <NotificationItem
                      group={group}
                      onClick={() => handleItemClick(group)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
