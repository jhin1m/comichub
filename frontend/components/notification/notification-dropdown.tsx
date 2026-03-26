'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import { notificationApi } from '@/lib/api/notification.api';
import { groupNotifications } from '@/lib/notification-grouping';
import { NotificationItem, getGroupHref } from '@/components/notification/notification-item';
import type { NotificationGroup } from '@/lib/notification-grouping';

interface NotificationDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadCountChange: (count: number) => void;
  children: React.ReactNode;
}

export function NotificationDropdown({
  open,
  onOpenChange,
  onUnreadCountChange,
  children,
}: NotificationDropdownProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);
  const unreadRef = useRef(0); // tracks authoritative unread count

  const fetchNotifications = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await notificationApi.list({ limit: 20 });
      setGroups(groupNotifications(res.data));
      unreadRef.current = res.unreadCount;
      onUnreadCountChange(res.unreadCount);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setGroups((prev) => prev.map((g) => ({ ...g, isUnread: false })));
      unreadRef.current = 0;
      onUnreadCountChange(0);
    } catch {
      // silently fail
    }
  };

  const handleItemClick = async (group: NotificationGroup) => {
    const href = getGroupHref(group);
    const unreadInGroup = group.notifications.filter((n) => !n.readAt).length;
    // mark all notifications in group as read
    await Promise.allSettled(
      group.notifications
        .filter((n) => !n.readAt)
        .map((n) => notificationApi.markRead(n.id)),
    );
    setGroups((prev) =>
      prev.map((g) =>
        g.key === group.key ? { ...g, isUnread: false } : g,
      ),
    );
    // sync badge count immediately
    unreadRef.current = Math.max(0, unreadRef.current - unreadInGroup);
    onUnreadCountChange(unreadRef.current);
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
            <h3 className="font-rajdhani font-bold text-base text-primary">Notifications</h3>
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
