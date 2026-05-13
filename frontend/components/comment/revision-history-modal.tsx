'use client';

import useSWR from 'swr';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { commentApi } from '@/lib/api/comment.api';
import { sanitizeCommentHtml } from '@/lib/comment/render-html';
import { formatRelativeDate } from '@/lib/utils';
import type { CommentRevision } from '@/types/comment.types';

interface RevisionHistoryModalProps {
  commentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevisionHistoryModal({ commentId, open, onOpenChange }: RevisionHistoryModalProps) {
  const { data: revisions, isLoading } = useSWR<CommentRevision[]>(
    open ? ['comment-revisions', commentId] : null,
    () => commentApi.getRevisions(commentId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogTitle>Edit history</DialogTitle>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-3 w-32 bg-elevated rounded" />
                  <div className="h-10 bg-elevated rounded" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && (!revisions || revisions.length === 0) && (
            <p className="text-muted text-sm text-center py-6">No edits yet.</p>
          )}

          {!isLoading && revisions && revisions.length > 0 && revisions.map((rev) => (
            <div key={rev.id} className="border border-default rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Avatar
                  src={rev.editorAvatar ?? undefined}
                  fallback={rev.editorName ?? '?'}
                  size="sm"
                />
                <span className="text-secondary text-xs font-medium">
                  {rev.editorName ?? 'Unknown'}
                </span>
                <span
                  className="text-muted text-[11px]"
                  title={new Date(rev.editedAt).toLocaleString()}
                >
                  {formatRelativeDate(rev.editedAt)}
                </span>
              </div>
              <div
                className="prose prose-invert prose-sm max-w-none text-primary text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(rev.content) }}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
