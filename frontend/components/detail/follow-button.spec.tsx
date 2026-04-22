import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { FollowButton } from './follow-button';
import React from 'react';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

const defaultProps = { mangaId: 1, followersCount: 42 };

// Mock useAuth to control user state per test
vi.mock('@/contexts/auth.context', () => ({
  useAuth: vi.fn(() => ({ user: null, loading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(), restoreSession: vi.fn(), setTokensFromOAuth: vi.fn() })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const authedUser = {
  user: { id: 1, uuid: 'u', email: 'a@b.com', name: 'User', avatar: null, role: 'user' as const },
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  restoreSession: vi.fn(),
  setTokensFromOAuth: vi.fn(),
};
const anonUser = { user: null, loading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(), restoreSession: vi.fn(), setTokensFromOAuth: vi.fn() };

describe('FollowButton', () => {
  it('renders Follow button with follower count', async () => {
    const { useAuth } = await import('@/contexts/auth.context');
    vi.mocked(useAuth).mockReturnValue(anonUser);

    render(<FollowButton {...defaultProps} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('Follow');
    expect(btn.textContent).toContain('42');
  });

  it('redirects to /login when unauthenticated user clicks Follow', async () => {
    const { useAuth } = await import('@/contexts/auth.context');
    vi.mocked(useAuth).mockReturnValue(anonUser);

    const { useRouter } = await import('next/navigation');
    const pushMock = useRouter().push;
    vi.mocked(pushMock).mockClear();

    const user = userEvent.setup();
    render(<FollowButton {...defaultProps} />);
    await user.click(screen.getByRole('button'));

    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('adds bookmark when authenticated user selects a folder', async () => {
    const { useAuth } = await import('@/contexts/auth.context');
    vi.mocked(useAuth).mockReturnValue(authedUser);

    let addCalled = false;
    server.use(
      http.get(`${BASE_URL}/bookmarks/status/1`, () =>
        HttpResponse.json(envelope({ bookmarked: false, folderId: null, folderName: null, folderSlug: null })),
      ),
      http.get(`${BASE_URL}/bookmarks/folders`, () =>
        HttpResponse.json(envelope([
          { id: 1, name: 'Reading', slug: 'reading', isDefault: true, count: 0, order: 0 },
        ])),
      ),
      http.post(`${BASE_URL}/bookmarks/1`, () => {
        addCalled = true;
        return HttpResponse.json(envelope({ bookmarked: true }));
      }),
    );

    const user = userEvent.setup();
    render(<FollowButton {...defaultProps} />);

    const btn = screen.getByRole('button');
    await waitFor(() => expect(btn.textContent).toContain('Follow'));

    // Open dropdown
    await user.click(btn);

    // Wait for folder item to appear inside Radix portal
    const folderItem = await screen.findByText('Reading');
    await user.click(folderItem);

    await waitFor(() => {
      expect(addCalled).toBe(true);
      expect(btn.textContent).toContain('Reading');
    });
  });

  it('shows already-following state when user follows on load', async () => {
    const { useAuth } = await import('@/contexts/auth.context');
    vi.mocked(useAuth).mockReturnValue(authedUser);

    server.use(
      http.get(`${BASE_URL}/bookmarks/status/1`, () =>
        HttpResponse.json(envelope({ bookmarked: true, folderId: 1, folderName: 'Reading', folderSlug: 'reading' })),
      ),
    );

    render(<FollowButton {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toContain('Reading');
    });
  });
});
