import { describe, it, expect, vi, afterEach } from 'vitest';
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

// Mock useAuth to control user state directly without the full auth flow
vi.mock('@/contexts/auth.context', () => ({
  useAuth: vi.fn(() => ({ user: null, loading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(), restoreSession: vi.fn(), setTokensFromOAuth: vi.fn() })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('FollowButton', () => {
  const originalLocation = window.location;

  afterEach(() => {
    // Restore window.location safely after each test
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });

  it('renders Follow button with follower count', async () => {
    const { useAuth } = await import('@/contexts/auth.context');
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(), restoreSession: vi.fn(), setTokensFromOAuth: vi.fn() });

    render(<FollowButton {...defaultProps} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain('Follow');
    expect(btn.textContent).toContain('42');
  });

  it('redirects to /login when unauthenticated user clicks Follow', async () => {
    const { useAuth } = await import('@/contexts/auth.context');
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(), restoreSession: vi.fn(), setTokensFromOAuth: vi.fn() });

    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...window.location, href: '' },
    });

    const user = userEvent.setup();
    render(<FollowButton {...defaultProps} />);
    await user.click(screen.getByRole('button'));

    expect(window.location.href).toContain('/login');
  });

  it('toggles to Following state when authenticated user clicks', async () => {
    const { useAuth } = await import('@/contexts/auth.context');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, uuid: 'u', email: 'a@b.com', name: 'User', avatar: null, role: 'user' },
      loading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(), restoreSession: vi.fn(), setTokensFromOAuth: vi.fn(),
    });

    server.use(
      http.get(`${BASE_URL}/manga/1/follow`, () =>
        HttpResponse.json(envelope({ followed: false })),
      ),
      http.post(`${BASE_URL}/manga/1/follow`, () =>
        HttpResponse.json(envelope({ followed: true, followersCount: 43 })),
      ),
    );

    const user = userEvent.setup();
    render(<FollowButton {...defaultProps} />);

    const btn = screen.getByRole('button');
    await waitFor(() => expect(btn.textContent).toContain('Follow'));

    await user.click(btn);

    await waitFor(() => {
      expect(btn.textContent).toContain('Following');
    });
  });

  it('shows already-following state when user follows on load', async () => {
    const { useAuth } = await import('@/contexts/auth.context');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, uuid: 'u', email: 'a@b.com', name: 'User', avatar: null, role: 'user' },
      loading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(), restoreSession: vi.fn(), setTokensFromOAuth: vi.fn(),
    });

    server.use(
      http.get(`${BASE_URL}/manga/1/follow`, () =>
        HttpResponse.json(envelope({ followed: true })),
      ),
    );

    render(<FollowButton {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toContain('Following');
    });
  });
});
