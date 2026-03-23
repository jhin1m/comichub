'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { commentApi } from '@/lib/api/comment.api';
import { useAuth } from '@/contexts/auth.context';
import type { Comment, CommentSort } from '@/types/comment.types';
import { CommentEditor } from './comment-editor';
import { CommentItem } from './comment-item';
import { CommentReplyThread } from './comment-reply-thread';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
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

  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<CommentSort>('best');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.ceil(total / LIMIT);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const fetcher =
        commentableType === 'manga'
          ? () => commentApi.listForManga(commentableId, { page, limit: LIMIT, sort })
          : () => commentApi.listForChapter(commentableId, { page, limit: LIMIT, sort });
      const res = await fetcher();
      setComments(res.data);
      setTotal(res.total);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [commentableType, commentableId, page, sort]);

  // Wait for auth to finish loading before fetching (so token is available for isLiked)
  useEffect(() => {
    if (!authLoading) {
      fetchComments();
    }
  }, [fetchComments, authLoading]);

  const handleSortChange = (value: CommentSort) => {
    setSort(value);
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    // Scroll to comment section top
    document.getElementById('comments-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNewComment = async (html: string) => {
    try {
      await commentApi.create({ commentableType, commentableId, content: html });
      toast.success('Comment posted');
      setPage(1);
      await fetchComments();
    } catch {
      toast.error('Failed to post comment');
      throw new Error('Failed to post comment');
    }
  };

  const handleCommentDeleted = (commentId: number) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setTotal((t) => Math.max(0, t - 1));
  };

  const sortOptions: { value: CommentSort; label: string }[] = [
    { value: 'best', label: 'Best' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
  ];

  return (
    <section id="comments-section">
      {/* Header: count + sort */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-secondary text-sm italic">
          {total} {total === 1 ? 'comment' : 'comments'}
        </span>
        <div className="flex items-center gap-3">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSortChange(opt.value)}
              className={cn(
                'text-xs font-medium transition-colors',
                sort === opt.value ? 'text-primary' : 'text-muted hover:text-secondary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top-level editor */}
      <div className="mb-4">
        <CommentEditor
          onSubmit={handleNewComment}
          isLoggedIn={!!user}
        />
      </div>

      {/* Comment list */}
      {loading ? (
        <CommentSkeleton />
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-muted text-xs">
          No comments yet. Be the first to comment!
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
                  onCommentAdded={fetchComments}
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
