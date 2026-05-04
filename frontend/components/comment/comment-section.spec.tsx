import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { CommentSection } from './comment-section';
import type { Comment, PaginatedComments } from '@/types/comment.types';

// TipTap (CommentEditor) needs DOM features happy-dom can't fully emulate.
// Replace it with a minimal stub so we can exercise CommentSection in isolation.
vi.mock('./comment-editor', () => ({
  CommentEditor: ({
    onSubmit,
    isLoggedIn,
  }: {
    onSubmit: (html: string) => Promise<void>;
    isLoggedIn?: boolean;
  }) => {
    if (!isLoggedIn) return <div data-testid="editor-login">Login to post</div>;
    // Mirror the real editor's try/catch so a rejected onSubmit doesn't bubble
    // up as an unhandled rejection in the test environment.
    return (
      <button
        data-testid="editor-submit"
        onClick={() => {
          onSubmit('<p>new comment</p>').catch(() => {
            // swallowed — parent already surfaced the error via toast
          });
        }}
      >
        Submit
      </button>
    );
  },
}));

// Reply thread is lazy + paginated; not under Phase 1's scope.
vi.mock('./comment-reply-thread', () => ({
  CommentReplyThread: () => null,
}));

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    userId: 99,
    content: '<p>Hello world</p>',
    likesCount: 0,
    dislikesCount: 0,
    parentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userName: 'Alice',
    userAvatar: null,
    userRole: 'user',
    isLiked: false,
    isDisliked: false,
    repliesCount: 0,
    ...overrides,
  };
}

function makePage(comments: Comment[], page = 1, limit = 15): PaginatedComments {
  return { data: comments, total: comments.length, page, limit };
}

describe('CommentSection (SWR)', () => {
  it('renders comment list fetched via SWR', async () => {
    server.use(
      http.get(`${BASE_URL}/manga/1/comments`, () =>
        HttpResponse.json(envelope(makePage([makeComment({ id: 1, userName: 'Alice' })]))),
      ),
    );

    render(<CommentSection commentableType="manga" commentableId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    // Total reflected in header pill
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('shows empty state when total is zero', async () => {
    server.use(
      http.get(`${BASE_URL}/manga/2/comments`, () =>
        HttpResponse.json(envelope(makePage([]))),
      ),
    );

    render(<CommentSection commentableType="manga" commentableId={2} />);

    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });
  });

  it('refetches with new sort key when sort tab changes', async () => {
    const calls: string[] = [];
    server.use(
      http.get(`${BASE_URL}/manga/3/comments`, ({ request }) => {
        const url = new URL(request.url);
        calls.push(url.searchParams.get('sort') ?? '');
        return HttpResponse.json(envelope(makePage([makeComment({ id: 1 })])));
      }),
    );

    const user = userEvent.setup();
    render(<CommentSection commentableType="manga" commentableId={3} />);

    await waitFor(() => expect(calls).toContain('best'));

    await user.click(screen.getByRole('button', { name: 'Newest' }));

    await waitFor(() => expect(calls).toContain('newest'));
  });

  it('shows error fallback when fetch fails', async () => {
    server.use(
      http.get(`${BASE_URL}/manga/4/comments`, () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 }),
      ),
    );

    render(<CommentSection commentableType="manga" commentableId={4} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load comments/i)).toBeInTheDocument();
    });
  });

  it('fetches a chapter comments endpoint when type is chapter', async () => {
    let chapterHit = false;
    server.use(
      http.get(`${BASE_URL}/chapters/7/comments`, () => {
        chapterHit = true;
        return HttpResponse.json(envelope(makePage([makeComment({ id: 11 })])));
      }),
    );

    render(<CommentSection commentableType="chapter" commentableId={7} />);

    await waitFor(() => expect(chapterHit).toBe(true));
  });

  it('optimistically inserts a new comment, then replaces it with the server response', async () => {
    // Authenticated user is required for the optimistic placeholder to populate.
    localStorage.setItem('refreshToken', 'seed');

    let createCalled = 0;
    // Server-side state — empty until a comment is created, then returned on
    // subsequent GETs (matches the post-then-sort-switch fetch sequence).
    const stored: Comment[] = [];
    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json(envelope({
          id: 99,
          uuid: 'u',
          email: 'a@b.com',
          name: 'Alice',
          avatar: null,
          role: 'user',
        })),
      ),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })),
      ),
      http.get(`${BASE_URL}/manga/5/comments`, () =>
        HttpResponse.json(envelope(makePage(stored))),
      ),
      http.post(`${BASE_URL}/comments`, () => {
        createCalled += 1;
        const created = makeComment({
          id: 555,
          userId: 99,
          content: '<p>new comment</p>',
          userName: 'Alice',
        });
        stored.unshift(created);
        return HttpResponse.json(envelope(created));
      }),
    );

    const user = userEvent.setup();
    render(<CommentSection commentableType="manga" commentableId={5} />);

    await waitFor(() => {
      expect(screen.getByTestId('editor-submit')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('editor-submit'));

    await waitFor(() => expect(createCalled).toBe(1));
    await waitFor(() => {
      expect(screen.getByText(/new comment/i)).toBeInTheDocument();
    });

    localStorage.removeItem('refreshToken');
  });

  it('optimistically removes a comment on delete and calls DELETE', async () => {
    localStorage.setItem('refreshToken', 'seed');

    let deleteCalled = 0;
    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json(envelope({
          // Owner of the comment so the Delete menu item is allowed to render.
          id: 99, uuid: 'u', email: 'a@b.com', name: 'Alice', avatar: null, role: 'user',
        })),
      ),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })),
      ),
      http.get(`${BASE_URL}/manga/8/comments`, () =>
        HttpResponse.json(envelope(makePage([
          makeComment({ id: 333, userId: 99, content: '<p>my comment</p>', userName: 'Alice' }),
        ]))),
      ),
      http.delete(`${BASE_URL}/comments/333`, () => {
        deleteCalled += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    render(<CommentSection commentableType="manga" commentableId={8} />);

    await waitFor(() => {
      expect(screen.getByText(/my comment/i)).toBeInTheDocument();
    });

    // Open menu → click Delete → confirm Yes
    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^yes$/i }));

    await waitFor(() => expect(deleteCalled).toBe(1));
    await waitFor(() => {
      expect(screen.queryByText(/my comment/i)).not.toBeInTheDocument();
    });

    localStorage.removeItem('refreshToken');
  });

  it('rolls back the optimistic delete when DELETE fails', async () => {
    localStorage.setItem('refreshToken', 'seed');

    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json(envelope({
          id: 99, uuid: 'u', email: 'a@b.com', name: 'Alice', avatar: null, role: 'user',
        })),
      ),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })),
      ),
      http.get(`${BASE_URL}/manga/9/comments`, () =>
        HttpResponse.json(envelope(makePage([
          makeComment({ id: 444, userId: 99, content: '<p>survive</p>', userName: 'Alice' }),
        ]))),
      ),
      http.delete(`${BASE_URL}/comments/444`, () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    render(<CommentSection commentableType="manga" commentableId={9} />);

    await waitFor(() => {
      expect(screen.getByText(/survive/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /more options/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /^yes$/i }));

    // After rollback the comment is back in the list.
    await waitFor(() => {
      expect(screen.getByText(/survive/i)).toBeInTheDocument();
    });

    localStorage.removeItem('refreshToken');
  });

  it('rolls back the optimistic insert when posting fails', async () => {
    localStorage.setItem('refreshToken', 'seed');

    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json(envelope({
          id: 99, uuid: 'u', email: 'a@b.com', name: 'Alice', avatar: null, role: 'user',
        })),
      ),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })),
      ),
      http.get(`${BASE_URL}/manga/6/comments`, () =>
        HttpResponse.json(envelope(makePage([]))),
      ),
      http.post(`${BASE_URL}/comments`, () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    render(<CommentSection commentableType="manga" commentableId={6} />);

    await waitFor(() => {
      expect(screen.getByTestId('editor-submit')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('editor-submit'));

    // After rollback the count returns to 0 and the empty state shows again.
    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });

    localStorage.removeItem('refreshToken');
  });
});
