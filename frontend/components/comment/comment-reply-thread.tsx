'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { commentApi } from '@/lib/api/comment.api';
import { useAuth } from '@/contexts/auth.context';
import type { Comment } from '@/types/comment.types';
import { CommentItem } from './comment-item';
import { Skeleton } from '@/components/ui/skeleton';

interface CommentReplyThreadProps {
  parentId: number;
  commentableType: 'manga' | 'chapter';
  commentableId: number;
  replyCount?: number;
  depth: number;
}

export function CommentReplyThread({
  parentId,
  commentableType,
  commentableId,
  replyCount = 0,
  depth,
}: CommentReplyThreadProps) {
  const { user } = useAuth();
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(replyCount);
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 5;

  const loadReplies = async (nextPage = 1) => {
    setLoading(true);
    try {
      const res = await commentApi.getReplies(parentId, { page: nextPage, limit: LIMIT });
      if (nextPage === 1) {
        setReplies(res.data);
      } else {
        setReplies((prev) => [...prev, ...res.data]);
      }
      setTotal(res.total);
      setPage(nextPage);
    } catch {
      toast.error('Failed to load replies');
    } finally {
      setLoading(false);
    }
  };

  const handleCommentDeleted = async (id: number) => {
    const snapshot = replies;
    const snapshotTotal = total;
    setReplies((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      await commentApi.remove(id);
      toast.success('Reply deleted');
    } catch {
      // Rollback: restore the previous list + count exactly as they were.
      setReplies(snapshot);
      setTotal(snapshotTotal);
      toast.error('Failed to delete reply');
      throw new Error('Failed to delete reply');
    }
  };

  // Reply optimistic: insert placeholder immediately, swap with real on
  // success, drop + toast on failure. Throwing keeps the editor's draft.
  const handleReplyPosted = async (html: string, replyParentId: number) => {
    if (!user) return;

    const placeholder: Comment = {
      id: -Date.now(),
      userId: user.id,
      content: html,
      likesCount: 0,
      dislikesCount: 0,
      parentId: replyParentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userName: user.name,
      userAvatar: user.avatar ?? null,
      userRole: user.role,
      isLiked: false,
      isDisliked: false,
      repliesCount: 0,
    };

    setReplies((prev) => [...prev, placeholder]);
    setTotal((t) => t + 1);

    try {
      const real = await commentApi.create({
        commentableType,
        commentableId,
        content: html,
        parentId: replyParentId,
      });
      setReplies((prev) =>
        prev.map((r) => (r.id === placeholder.id ? { ...placeholder, ...real } : r)),
      );
      toast.success('Reply posted');
    } catch {
      setReplies((prev) => prev.filter((r) => r.id !== placeholder.id));
      setTotal((t) => Math.max(0, t - 1));
      toast.error('Failed to post reply');
      throw new Error('Failed to post reply');
    }
  };

  if (total === 0 && replies.length === 0 && !expanded) return null;

  // Lazy-load: show "View N replies" button until user clicks
  if (!expanded && replies.length === 0 && replyCount > 0) {
    return (
      <div className="ml-8 pl-3 mt-0.5">
        <button
          onClick={() => { setExpanded(true); loadReplies(1); }}
          className="text-[11px] text-muted hover:text-accent transition-colors py-1"
        >
          View {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
        </button>
      </div>
    );
  }

  return (
    <div className="ml-8 border-l-2 border-default/40 hover:border-accent/40 pl-3 mt-0.5 transition-colors">
      {loading && replies.length === 0 ? (
        <div className="space-y-2 py-1.5">
          {Array.from({ length: Math.min(replyCount, 3) }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-2 w-20" />
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {replies.map((reply) => (
            <div key={reply.id}>
              <CommentItem
                comment={reply}
                commentableType={commentableType}
                commentableId={commentableId}
                onReplyPosted={handleReplyPosted}
                onCommentDeleted={handleCommentDeleted}
                depth={depth + 1}
              />
              {depth + 1 < 2 && (
                <CommentReplyThread
                  parentId={reply.id}
                  commentableType={commentableType}
                  commentableId={commentableId}
                  replyCount={reply.repliesCount ?? 0}
                  depth={depth + 1}
                />
              )}
            </div>
          ))}

          {replies.length < total && (
            <button
              onClick={() => loadReplies(page + 1)}
              disabled={loading}
              className="text-[11px] text-muted hover:text-primary transition-colors py-1 disabled:opacity-40"
            >
              {loading ? 'Loading...' : `Load more (${total - replies.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
