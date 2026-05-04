'use client';

import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import { commentApi } from '@/lib/api/comment.api';
import { useAuth } from '@/contexts/auth.context';
import { commentListKey } from '@/lib/swr/swr-keys';
import type { Comment, PaginatedComments, CommentSort } from '@/types/comment.types';
const CommentEditor = lazy(() => import('./comment-editor').then(m => ({ default: m.CommentEditor })));
import { CommentItem } from './comment-item';
import { CommentReplyThread } from './comment-reply-thread';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatCircleDotsIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const LIMIT = 15;

interface CommentSectionProps {
  commentableType: 'manga' | 'chapter';
  commentableId: number;
}

function CommentSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-2.5 py-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommentSection({ commentableType, commentableId }: CommentSectionProps) {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('cmid') ? Number(searchParams.get('cmid')) : null;

  const [sort, setSort] = useState<CommentSort>('best');
  const [page, setPage] = useState(1);

  // Wait for auth to settle before fetching: isLiked/isDisliked depend on the
  // bearer token being present. `null` key short-circuits SWR.
  const swrKey = !authLoading
    ? commentListKey(commentableType, commentableId, page, LIMIT, sort)
    : null;

  const { data, isLoading, error, mutate } = useSWR<PaginatedComments>(swrKey, {
    onError: () => toast.error('Failed to load comments'),
  });
  const { mutate: globalMutate } = useSWRConfig();

  const comments = data?.data ?? [];
  const total = data?.total ?? 0;
  const loading = authLoading || (!!swrKey && isLoading && !data);
  const totalPages = Math.ceil(total / LIMIT);

  const handleSortChange = (value: CommentSort) => {
    setSort(value);
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewComment = async (html: string) => {
    if (!user) return;

    // Force sort=newest + page=1 BEFORE the optimistic write so the placeholder
    // lands in the cache slot the next render will read. Without this swap the
    // new comment would land in the previous (e.g. `best`) cache and flash
    // out when React re-renders into the new sort.
    const targetSort: CommentSort = 'newest';
    const targetPage = 1;
    if (sort !== targetSort) setSort(targetSort);
    if (page !== targetPage) setPage(targetPage);

    const targetKey = commentListKey(commentableType, commentableId, targetPage, LIMIT, targetSort);

    // Negative timestamp ID — won't collide with the positive serial PK from
    // the DB, so the placeholder is uniquely identifiable until the server
    // response replaces it.
    const placeholder: Comment = {
      id: -Date.now(),
      userId: user.id,
      content: html,
      likesCount: 0,
      dislikesCount: 0,
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userName: user.name,
      userAvatar: user.avatar ?? null,
      userRole: user.role,
      isLiked: false,
      isDisliked: false,
      repliesCount: 0,
    };

    try {
      // Target the new key explicitly via global mutate. The bound `mutate`
      // from useSWR still references the previous key in this tick.
      await globalMutate<PaginatedComments>(
        targetKey,
        async (current?: PaginatedComments) => {
          const real = await commentApi.create({ commentableType, commentableId, content: html });
          const realComment: Comment = {
            ...placeholder,
            ...real,
            repliesCount: real.repliesCount ?? 0,
          };
          if (!current) {
            return { data: [realComment], total: 1, page: targetPage, limit: LIMIT };
          }
          // Drop the placeholder if it landed in the cache before the response.
          const filtered = current.data.filter((c) => c.id !== placeholder.id);
          return { ...current, data: [realComment, ...filtered], total: current.total + 1 };
        },
        {
          optimisticData: (current?: PaginatedComments) =>
            current
              ? { ...current, data: [placeholder, ...current.data], total: current.total + 1 }
              : { data: [placeholder], total: 1, page: targetPage, limit: LIMIT },
          rollbackOnError: true,
          revalidate: false,
          populateCache: true,
        },
      );
      toast.success('Comment posted');
    } catch {
      toast.error('Failed to post comment');
      throw new Error('Failed to post comment');
    }
  };

  const handleCommentDeleted = async (commentId: number) => {
    try {
      await mutate(
        async (current?: PaginatedComments) => {
          await commentApi.remove(commentId);
          if (!current) return current;
          return {
            ...current,
            data: current.data.filter((c) => c.id !== commentId),
            total: Math.max(0, current.total - 1),
          };
        },
        {
          optimisticData: (current?: PaginatedComments) =>
            current
              ? {
                  ...current,
                  data: current.data.filter((c) => c.id !== commentId),
                  total: Math.max(0, current.total - 1),
                }
              : current!,
          rollbackOnError: true,
          revalidate: false,
          populateCache: true,
        },
      );
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
      throw new Error('Failed to delete comment');
    }
  };

  // Top-level reply: post the API call here and revalidate the section cache so
  // the parent's repliesCount updates. The reply itself appears inside the
  // CommentReplyThread when the user expands it (or already expanded — its own
  // optimistic flow is owned by the thread component).
  const handleTopLevelReply = async (html: string, parentId: number) => {
    try {
      await commentApi.create({ commentableType, commentableId, content: html, parentId });
      toast.success('Reply posted');
      await mutate();
    } catch {
      toast.error('Failed to post reply');
      throw new Error('Failed to post reply');
    }
  };

  const sortOptions: { value: CommentSort; label: string }[] = [
    { value: 'best', label: 'Best' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
  ];

  return (
    <section id="comments-section">
      {/* Header: count + sort tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChatCircleDotsIcon size={18} className="text-accent" />
          <span className="text-primary text-sm font-rajdhani font-bold uppercase tracking-wider">
            Comments
          </span>
          <span className="text-muted text-xs">({total})</span>
        </div>
        <div className="flex items-center bg-surface/60 rounded-lg p-0.5">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all',
                sort === opt.value
                  ? 'bg-elevated text-primary shadow-sm'
                  : 'text-muted hover:text-secondary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top-level editor — lazy-loaded to defer TipTap bundle */}
      <div className="mb-4">
        <Suspense fallback={<div className="h-[70px] bg-elevated/60 rounded-lg animate-pulse" />}>
          <CommentEditor
            onSubmit={handleNewComment}
            isLoggedIn={!!user}
          />
        </Suspense>
      </div>

      {/* Comment list */}
      {loading ? (
        <CommentSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ChatCircleDotsIcon size={40} className="text-muted mb-3" />
          <p className="text-secondary text-sm">Failed to load comments</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ChatCircleDotsIcon size={40} className="text-muted mb-3" />
          <p className="text-secondary text-sm">No comments yet</p>
          <p className="text-muted text-xs mt-1">Be the first to share your thoughts!</p>
        </div>
      ) : (
        <>
          <div>
            {comments.map((comment) => (
              <div key={comment.id}>
                <CommentItem
                  comment={comment}
                  commentableType={commentableType}
                  commentableId={commentableId}
                  onReplyPosted={handleTopLevelReply}
                  onCommentDeleted={handleCommentDeleted}
                  depth={0}
                  highlighted={highlightId === comment.id}
                />
                <CommentReplyThread
                  parentId={comment.id}
                  commentableType={commentableType}
                  commentableId={commentableId}
                  replyCount={comment.repliesCount ?? 0}
                  depth={0}
                />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
