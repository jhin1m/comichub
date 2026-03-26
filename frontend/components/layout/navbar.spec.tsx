import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { useRouter } from 'next/navigation';
import Navbar from './navbar';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

// Navbar uses SSE stream — mock the hook to prevent real fetch-event-source calls
vi.mock('@/hooks/use-notification-stream', () => ({
  useNotificationStream: vi.fn(),
}));

describe('Navbar', () => {
  it('shows LOGIN button when unauthenticated', async () => {
    // No refreshToken → AuthProvider resolves null user
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });
  });

  it('shows user avatar and not LOGIN when authenticated', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json(envelope({ id: 1, uuid: 'u', email: 'a@b.com', name: 'Alice', avatar: null, role: 'user' })),
      ),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })),
      ),
      http.get(`${BASE_URL}/notifications/unread-count`, () =>
        HttpResponse.json(envelope({ count: 0 })),
      ),
    );

    localStorage.setItem('refreshToken', 'seed-token');
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /login/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /user menu/i })).toBeInTheDocument();
    });

    localStorage.removeItem('refreshToken');
  });

  it('opens mobile menu when hamburger is clicked', async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle menu/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /toggle menu/i }));
    expect(screen.getByRole('link', { name: /browse/i })).toBeInTheDocument();
  });

  it('navigates to /login when LOGIN button is clicked', async () => {
    const pushMock = useRouter().push;
    vi.mocked(pushMock).mockClear();

    const user = userEvent.setup();
    render(<Navbar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /login/i }));
    expect(pushMock).toHaveBeenCalledWith('/login');
  });
});
