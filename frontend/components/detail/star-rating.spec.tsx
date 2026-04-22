import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import StarRating from './star-rating';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

const defaultProps = {
  mangaId: 1,
  averageRating: '4.0',
  totalRatings: 150,
};

describe('StarRating', () => {
  it('renders 5 star buttons', () => {
    render(<StarRating {...defaultProps} />);
    const stars = screen.getAllByRole('button', { name: /rate \d star/i });
    expect(stars).toHaveLength(5);
  });

  it('displays score on 10-point scale derived from averageRating', () => {
    render(<StarRating {...defaultProps} averageRating="3.5" />);
    // 3.5 * 2 = 7.0 — appears in both the large score span and the sub-label
    const scores = screen.getAllByText('7.0');
    expect(scores.length).toBeGreaterThanOrEqual(1);
  });

  it('displays total ratings count', () => {
    render(<StarRating {...defaultProps} totalRatings={1234} />);
    expect(screen.getByText(/1,234/)).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated user clicks a star', async () => {
    const { useRouter } = await import('next/navigation');
    const pushMock = useRouter().push;
    vi.mocked(pushMock).mockClear();

    const user = userEvent.setup();
    render(<StarRating {...defaultProps} />);

    await user.click(screen.getAllByRole('button', { name: /rate \d star/i })[2]);

    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('submits rating when authenticated user clicks a star', async () => {
    let rateCalled = false;
    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json(envelope({ id: 1, uuid: 'u', email: 'a@b.com', name: 'User', avatar: null, role: 'user' })),
      ),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })),
      ),
      http.get(`${BASE_URL}/manga/1/rating`, () =>
        HttpResponse.json(envelope({ score: null })),
      ),
      http.post(`${BASE_URL}/manga/1/rate`, () => {
        rateCalled = true;
        return HttpResponse.json(envelope({ success: true }));
      }),
    );

    localStorage.setItem('refreshToken', 'seed-token');

    const user = userEvent.setup();
    render(<StarRating {...defaultProps} />);

    // Wait for auth context to resolve (refresh + /me round-trip)
    await new Promise((r) => setTimeout(r, 150));

    await user.click(screen.getAllByRole('button', { name: /rate \d star/i })[3]);

    // After click, user-rating label appears (source: "(yours: X.X)")
    await waitFor(() => {
      expect(rateCalled).toBe(true);
      expect(screen.getByText(/yours:/i)).toBeInTheDocument();
    });

    localStorage.removeItem('refreshToken');
  });
});
