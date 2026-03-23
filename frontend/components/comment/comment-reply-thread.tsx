'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { commentApi } from '@/lib/api/comment.api';
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
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(replyCount);
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

  // Auto-load replies on mount if there are any
  useEffect(() => {
    if (replyCount > 0) {
      loadReplies(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, replyCount]);

  const handleCommentDeleted = (id: number) => {
    setReplies((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  if (total === 0 && replies.length === 0) return null;

  return (
    <div className="ml-8 border-l border-default/40 pl-3 mt-0.5">
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
            <CommentItem
              key={reply.id}
              comment={reply}
              commentableType={commentableType}
              commentableId={commentableId}
              onCommentAdded={() => loadReplies(1)}
              onCommentDeleted={handleCommentDeleted}
              depth={depth + 1}
            />
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
