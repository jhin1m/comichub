import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { NotificationDropdown } from './notification-dropdown';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

// Shape must match NotificationItem + ChapterNotificationData from notification-types.ts
function makeNotification(id: number, readAt: string | null = null) {
  return {
    id: String(id),
    notifiableType: 'manga',
    notifiableId: 1,
    type: 'chapter.created',
    data: {
      mangaId: 1,
      mangaTitle: 'Test Manga',
      mangaSlug: 'test-manga',
      chapterId: id,
      chapterNumber: id,
      mangaCover: null,
    },
    readAt,
    createdAt: new Date().toISOString(),
  };
}

describe('NotificationDropdown', () => {
  it('shows "No notifications yet" when list is empty', async () => {
    server.use(
      http.get(`${BASE_URL}/notifications`, () =>
        HttpResponse.json(envelope({ data: [], total: 0, unreadCount: 0, page: 1, limit: 20, totalPages: 0 })),
      ),
    );

    const onOpenChange = vi.fn();
    const onUnreadCountChange = vi.fn();

    render(
      <NotificationDropdown open onOpenChange={onOpenChange} onUnreadCountChange={onUnreadCountChange}>
        <button>Bell</button>
      </NotificationDropdown>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
    });
  });

  it('renders grouped notifications and shows unread indicator', async () => {
    server.use(
      http.get(`${BASE_URL}/notifications`, () =>
        HttpResponse.json(envelope({
          data: [
            makeNotification(1, null),   // unread
            makeNotification(2, null),   // unread — same manga, groups with #1
          ],
          total: 2,
          unreadCount: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        })),
      ),
    );

    const onUnreadCountChange = vi.fn();

    render(
      <NotificationDropdown open onOpenChange={vi.fn()} onUnreadCountChange={onUnreadCountChange}>
        <button>Bell</button>
      </NotificationDropdown>,
    );

    await waitFor(() => {
      // groupNotifications groups by manga — one group for 2 uploads on same manga
      expect(screen.getByText('Test Manga')).toBeInTheDocument();
    });

    // unreadCount synced to parent
    expect(onUnreadCountChange).toHaveBeenCalledWith(2);
  });

  it('shows "Mark all read" button when there are unread notifications', async () => {
    server.use(
      http.get(`${BASE_URL}/notifications`, () =>
        HttpResponse.json(envelope({
          data: [makeNotification(1, null)],
          total: 1,
          unreadCount: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        })),
      ),
    );

    render(
      <NotificationDropdown open onOpenChange={vi.fn()} onUnreadCountChange={vi.fn()}>
        <button>Bell</button>
      </NotificationDropdown>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
    });
  });

  it('clears unread groups after "Mark all read" is clicked', async () => {
    server.use(
      http.get(`${BASE_URL}/notifications`, () =>
        HttpResponse.json(envelope({
          data: [makeNotification(1, null)],
          total: 1,
          unreadCount: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        })),
      ),
      http.patch(`${BASE_URL}/notifications/read-all`, () =>
        HttpResponse.json(envelope(null)),
      ),
    );

    const onUnreadCountChange = vi.fn();
    const user = userEvent.setup();

    render(
      <NotificationDropdown open onOpenChange={vi.fn()} onUnreadCountChange={onUnreadCountChange}>
        <button>Bell</button>
      </NotificationDropdown>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /mark all read/i }));

    await waitFor(() => {
      // After marking all read, button disappears and count resets to 0
      expect(screen.queryByRole('button', { name: /mark all read/i })).not.toBeInTheDocument();
      expect(onUnreadCountChange).toHaveBeenCalledWith(0);
    });
  });
});
