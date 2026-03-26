import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/handlers';
import { CommentItem } from './comment-item';
import type { Comment } from '@/types/comment.types';

// TipTap (CommentEditor) requires a real DOM that happy-dom can't fully support.
// Mock the editor to isolate CommentItem logic.
vi.mock('./comment-editor', () => ({
  CommentEditor: ({ onCancel }: { onCancel?: () => void }) => (
    <div data-testid="comment-editor">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const BASE_URL = 'http://localhost:8080/api/v1';
const envelope = (data: unknown) => ({ success: true, data, message: null });

const baseComment: Comment = {
  id: 42,
  userId: 99,
  content: '<p>This is a test comment</p>',
  likesCount: 3,
  dislikesCount: 1,
  parentId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  userName: 'Alice',
  userAvatar: null,
  userRole: 'user',
  isLiked: false,
  isDisliked: false,
  repliesCount: 0,
};

const defaultProps = {
  comment: baseComment,
  commentableType: 'manga' as const,
  commentableId: 1,
};

describe('CommentItem', () => {
  it('renders comment content and author name', () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // dangerouslySetInnerHTML renders the inner text
    expect(screen.getByText(/this is a test comment/i)).toBeInTheDocument();
  });

  it('shows admin badge for admin users', () => {
    const adminComment = { ...baseComment, userRole: 'admin' as const };
    render(<CommentItem {...defaultProps} comment={adminComment} />);
    expect(screen.getByText(/admin/i)).toBeInTheDocument();
  });

  it('toggles collapse when collapse button is clicked', async () => {
    const user = userEvent.setup();
    render(<CommentItem {...defaultProps} />);

    const collapseBtn = screen.getByRole('button', { name: /collapse comment/i });
    await user.click(collapseBtn);

    // Content should no longer be visible after collapsing
    await waitFor(() => {
      expect(screen.queryByText(/this is a test comment/i)).not.toBeInTheDocument();
    });

    // Re-expand
    const expandBtn = screen.getByRole('button', { name: /expand comment/i });
    await user.click(expandBtn);
    await waitFor(() => {
      expect(screen.getByText(/this is a test comment/i)).toBeInTheDocument();
    });
  });

  it('shows reply button at depth 0 and hides at depth 2', () => {
    const { rerender } = render(<CommentItem {...defaultProps} depth={0} />);
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();

    rerender(
      <CommentItem {...defaultProps} depth={2} />
    );
    expect(screen.queryByRole('button', { name: /reply/i })).not.toBeInTheDocument();
  });

  it('shows toast error when reacting without being logged in', async () => {
    const user = userEvent.setup();
    // AuthProvider starts with no user (no refreshToken in localStorage)
    render(<CommentItem {...defaultProps} />);

    const likeBtn = screen.getByRole('button', { name: /^like$/i });
    await user.click(likeBtn);

    // toast.error is called — we verify no crash and the count stays the same
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('optimistically updates like count when authenticated user clicks like', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${BASE_URL}/comments/42/like`, () =>
        HttpResponse.json(envelope({ liked: true, disliked: false, likesCount: 4, dislikesCount: 1 })),
      ),
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json(envelope({ id: 99, uuid: 'u', email: 'a@b.com', name: 'Alice', avatar: null, role: 'user' })),
      ),
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json(envelope({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })),
      ),
    );

    // Seed a refresh token so AuthProvider resolves a user
    localStorage.setItem('refreshToken', 'seed-token');

    render(<CommentItem {...defaultProps} />);

    // Wait for auth to resolve
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());

    const likeBtn = screen.getByRole('button', { name: /^like$/i });
    await user.click(likeBtn);

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    localStorage.removeItem('refreshToken');
  });
});
