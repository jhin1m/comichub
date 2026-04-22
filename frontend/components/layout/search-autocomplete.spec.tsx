import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { SearchAutocomplete } from './search-autocomplete';

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

describe('SearchAutocomplete', () => {
  it('renders the desktop search input', () => {
    render(<SearchAutocomplete />);
    expect(screen.getByPlaceholderText(/search comic/i)).toBeInTheDocument();
  });

  it('does not fetch suggestions for queries shorter than 2 chars', async () => {
    const user = userEvent.setup();
    const suggestSpy = vi.fn(() => HttpResponse.json(envelope([])));
    server.use(http.get(`${BASE_URL}/search/suggest`, suggestSpy));

    render(<SearchAutocomplete />);
    await user.type(screen.getByPlaceholderText(/search comic/i), 'a');

    // Allow debounce to potentially fire
    await new Promise((r) => setTimeout(r, 400));
    expect(suggestSpy).not.toHaveBeenCalled();
  });

  it('shows autocomplete results after debounce', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${BASE_URL}/search/suggest`, () =>
        HttpResponse.json(envelope([
          { id: 1, title: 'One Piece', slug: 'one-piece', cover: null },
          { id: 2, title: 'One Punch Man', slug: 'one-punch-man', cover: null },
        ])),
      ),
    );

    render(<SearchAutocomplete />);
    await user.type(screen.getByPlaceholderText(/search comic/i), 'one');

    await waitFor(() => {
      expect(screen.getByText('One Piece')).toBeInTheDocument();
      expect(screen.getByText('One Punch Man')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('navigates to manga page when autocomplete result is clicked', async () => {
    const { useRouter } = await import('next/navigation');
    const pushMock = useRouter().push;

    const user = userEvent.setup();
    server.use(
      http.get(`${BASE_URL}/search/suggest`, () =>
        HttpResponse.json(envelope([
          { id: 1, title: 'Naruto', slug: 'naruto', cover: null },
        ])),
      ),
    );

    render(<SearchAutocomplete />);
    await user.type(screen.getByPlaceholderText(/search comic/i), 'naru');

    await waitFor(() => {
      expect(screen.getByText('Naruto')).toBeInTheDocument();
    }, { timeout: 1000 });

    await user.click(screen.getByText('Naruto'));
    expect(pushMock).toHaveBeenCalledWith('/manga/1-naruto');
  });

  it('submits form and navigates to browse with search query', async () => {
    const { useRouter } = await import('next/navigation');
    const pushMock = useRouter().push;

    const user = userEvent.setup();
    server.use(
      http.get(`${BASE_URL}/search/suggest`, () => HttpResponse.json(envelope([]))),
    );

    render(<SearchAutocomplete />);
    const input = screen.getByPlaceholderText(/search comic/i);
    await user.type(input, 'dragon ball');
    await user.keyboard('{Enter}');

    expect(pushMock).toHaveBeenCalledWith('/browse?search=dragon%20ball');
  });

  it('clears input when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchAutocomplete />);

    const input = screen.getByPlaceholderText(/search comic/i);
    await user.type(input, 'something');

    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearBtn);

    expect(input).toHaveValue('');
  });
});
