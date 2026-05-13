'use client';

import { useState, useEffect, useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  ArrowBendUpLeftIcon,
  DotsThreeOutlineIcon,
  PencilSimpleIcon,
  TrashIcon,
  LinkSimpleIcon,
  PushPinIcon,
  FlagIcon,
  ClockCounterClockwiseIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { CommentEditor } from './comment-editor';
import { RevisionHistoryModal } from './revision-history-modal';
import { ReportCommentModal } from './report-comment-modal';
import { commentApi } from '@/lib/api/comment.api';
import { useAuth } from '@/hooks/use-auth';
import { sanitizeCommentHtml } from '@/lib/comment/render-html';
import type { Comment } from '@/types/comment.types';
import { cn, formatRelativeDate } from '@/lib/utils';

function handleSpoilerClick(e: React.MouseEvent<HTMLDivElement>) {
  const target = e.target as HTMLElement;
  if (target.classList.contains('spoiler')) {
    target.classList.toggle('revealed');
  }
}

/** Role badge for admin/special users */
function RoleBadge({ role }: { role?: string }) {
  if (role === 'admin') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-accent-muted text-accent leading-none">
        Admin
      </span>
    );
  }
  return null;
}

interface CommentItemProps {
  comment: Comment;
  commentableType: 'manga' | 'chapter';
  commentableId: number;
  onReplyPosted?: (html: string, parentId: number) => Promise<void>;
  onCommentDeleted?: (commentId: number) => Promise<void>;
  /** Called after pin/unpin so parent can revalidate */
  onPinToggled?: () => void;
  depth?: number;
  highlighted?: boolean;
}

export function CommentItem({
  comment,
  commentableType,
  commentableId,
  onReplyPosted,
  onCommentDeleted,
  onPinToggled,
  depth = 0,
  highlighted = false,
}: CommentItemProps) {
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [liked, setLiked] = useState(comment.isLiked ?? false);
  const [disliked, setDisliked] = useState(comment.isDisliked ?? false);
  const [likesCount, setLikesCount] = useState(comment.likesCount);
  const [dislikesCount, setDislikesCount] = useState(comment.dislikesCount);
  const [showReply, setShowReply] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [flash, setFlash] = useState(highlighted);
  const [isPinned, setIsPinned] = useState(comment.isPinned);
  const [showRevisions, setShowRevisions] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const isOwner = user?.id === comment.userId;
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [highlighted]);

  const handleReaction = async (type: 'like' | 'dislike') => {
    if (!user) { toast.error('Login to react'); return; }
    const prev = { liked, disliked, likesCount, dislikesCount };
    if (type === 'like') {
      setLiked(!liked);
      setLikesCount(liked ? likesCount - 1 : likesCount + 1);
      if (disliked) { setDisliked(false); setDislikesCount(dislikesCount - 1); }
    } else {
      setDisliked(!disliked);
      setDislikesCount(disliked ? dislikesCount - 1 : dislikesCount + 1);
      if (liked) { setLiked(false); setLikesCount(likesCount - 1); }
    }
    try {
      const res = type === 'like'
        ? await commentApi.toggleLike(comment.id)
        : await commentApi.toggleDislike(comment.id);
      setLiked(res.liked);
      setDisliked(res.disliked);
      setLikesCount(res.likesCount);
      setDislikesCount(res.dislikesCount);
    } catch {
      setLiked(prev.liked);
      setDisliked(prev.disliked);
      setLikesCount(prev.likesCount);
      setDislikesCount(prev.dislikesCount);
      toast.error('Failed to update reaction');
    }
  };

  const handleReplySubmit = async (html: string) => {
    if (!onReplyPosted) return;
    await onReplyPosted(html, comment.id);
    setShowReply(false);
  };

  const handleEditSubmit = async (html: string) => {
    try {
      await commentApi.update(comment.id, html);
      setContent(html);
      setShowEdit(false);
      toast.success('Comment updated');
    } catch {
      toast.error('Failed to update comment');
    }
  };

  const handleDelete = async () => {
    if (!onCommentDeleted) return;
    setConfirmingDelete(false);
    try {
      await onCommentDeleted(comment.id);
    } catch {
      // handled by parent
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?cmid=${comment.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  const handlePinToggle = async () => {
    try {
      if (isPinned) {
        await commentApi.unpin(comment.id);
        setIsPinned(false);
        toast.success('Comment unpinned');
      } else {
        await commentApi.pin(comment.id);
        setIsPinned(true);
        toast.success('Comment pinned');
      }
      onPinToggled?.();
    } catch {
      toast.error('Could not complete this action');
    }
  };

  return (
    <div
      ref={ref}
      id={`comment-${comment.id}`}
      className={cn(
        'py-3 transition-colors duration-1000',
        flash && 'bg-accent-muted rounded-lg -mx-2 px-2',
      )}
    >
      <div className="flex gap-2.5">
        {/* Avatar with accent ring for admin */}
        <Avatar
          src={comment.userAvatar ?? undefined}
          fallback={comment.userName}
          size="sm"
          className={cn(comment.userRole === 'admin' && 'ring-1 ring-accent')}
        />
        <div className="flex-1 min-w-0">
          {/* Header: name + role badge + time + pin badge + collapse */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-primary font-semibold text-xs">{comment.userName}</span>
              <RoleBadge role={comment.userRole} />
              <span className="text-muted text-[11px]" title={new Date(comment.createdAt).toLocaleString()}>
                {formatRelativeDate(comment.createdAt)}
              </span>
              {/* "edited" label */}
              {comment.editedAt && (
                <button
                  onClick={() => setShowRevisions(true)}
                  className="flex items-center gap-0.5 text-muted text-[10px] hover:text-secondary transition-colors"
                  title="View edit history"
                >
                  <ClockCounterClockwiseIcon size={10} />
                  <span>edited</span>
                </button>
              )}
              {/* Moderation status badges (owner only) */}
              {isOwner && comment.moderationStatus === 'pending' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-warning/20 text-warning leading-none">
                  pending review
                </span>
              )}
              {isOwner && comment.moderationStatus === 'rejected' && (
                <Tooltip.Provider delayDuration={200}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted/20 text-muted leading-none cursor-help">
                        hidden
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-elevated border border-default rounded px-2 py-1 text-xs text-secondary shadow-lg z-50"
                        sideOffset={4}
                      >
                        This comment violated guidelines and was hidden.
                        <Tooltip.Arrow className="fill-elevated" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Pinned badge */}
              {isPinned && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-accent-muted text-accent leading-none">
                  <PushPinIcon size={9} weight="fill" />
                  Pinned
                </span>
              )}
              <button
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand comment' : 'Collapse comment'}
                className="text-muted hover:text-primary text-xs font-mono leading-none transition-colors px-1"
              >
                {collapsed ? '+' : '–'}
              </button>
            </div>
          </div>

          {!collapsed && (
            <>
              {/* Content */}
              {showEdit ? (
                <div className="mt-1.5">
                  <CommentEditor
                    onSubmit={handleEditSubmit}
                    onCancel={() => setShowEdit(false)}
                    initialContent={content}
                    compact
                  />
                </div>
              ) : (
                <div
                  className="text-primary text-xs leading-relaxed mt-0.5 prose prose-invert prose-sm max-w-none [&_.mention]:text-accent [&_.mention]:font-medium [&_.mention]:hover:underline [&_.mention]:cursor-pointer"
                  dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(content) }}
                  onClick={handleSpoilerClick}
                />
              )}

              {/* Actions: reaction pills + reply + more */}
              <div className="flex items-center gap-2 mt-1.5">
                {/* Reaction pills */}
                <div className="flex items-center gap-0.5 bg-surface/60 rounded-full px-1">
                  <button
                    onClick={() => handleReaction('like')}
                    aria-label={liked ? 'Unlike' : 'Like'}
                    className={cn(
                      'flex items-center gap-0.5 px-1.5 py-1 rounded-full text-[11px] transition-colors',
                      liked ? 'text-accent' : 'text-muted hover:text-primary',
                    )}
                  >
                    <ThumbsUpIcon size={12} weight={liked ? 'fill' : 'regular'} />
                    <span>{likesCount}</span>
                  </button>

                  <div className="w-px h-3 bg-default" />

                  <button
                    onClick={() => handleReaction('dislike')}
                    aria-label={disliked ? 'Remove dislike' : 'Dislike'}
                    className={cn(
                      'flex items-center gap-0.5 px-1.5 py-1 rounded-full text-[11px] transition-colors',
                      disliked ? 'text-accent' : 'text-muted hover:text-primary',
                    )}
                  >
                    <ThumbsDownIcon size={12} weight={disliked ? 'fill' : 'regular'} />
                    <span>{dislikesCount}</span>
                  </button>
                </div>

                {depth < 2 && (
                  <button
                    onClick={() => setShowReply(!showReply)}
                    aria-label="Reply"
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-primary transition-colors"
                  >
                    <ArrowBendUpLeftIcon size={12} />
                    <span>Reply</span>
                  </button>
                )}

                {/* Radix DropdownMenu for More actions */}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      aria-label="More options"
                      className="flex items-center text-[11px] text-muted hover:text-primary transition-colors"
                    >
                      <DotsThreeOutlineIcon size={14} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="bg-elevated border border-default rounded-md shadow-lg py-1 z-50 min-w-[130px] animate-in fade-in-0 zoom-in-95"
                      sideOffset={4}
                      align="start"
                    >
                      <DropdownMenu.Item
                        onClick={handleCopyLink}
                        className="px-3 py-1.5 text-xs text-secondary hover:bg-hover hover:text-primary transition-colors cursor-pointer outline-none flex items-center gap-1.5"
                      >
                        <LinkSimpleIcon size={11} /> Copy link
                      </DropdownMenu.Item>

                      {isOwner && (
                        <DropdownMenu.Item
                          onClick={() => setShowEdit(true)}
                          className="px-3 py-1.5 text-xs text-secondary hover:bg-hover hover:text-primary transition-colors cursor-pointer outline-none flex items-center gap-1.5"
                        >
                          <PencilSimpleIcon size={11} /> Edit
                        </DropdownMenu.Item>
                      )}

                      {/* Report — logged-in non-owner */}
                      {user && !isOwner && (
                        <DropdownMenu.Item
                          onClick={() => setShowReport(true)}
                          className="px-3 py-1.5 text-xs text-secondary hover:bg-hover hover:text-primary transition-colors cursor-pointer outline-none flex items-center gap-1.5"
                        >
                          <FlagIcon size={11} /> Report
                        </DropdownMenu.Item>
                      )}

                      {/* Admin: pin/unpin */}
                      {isAdmin && (
                        <DropdownMenu.Item
                          onClick={handlePinToggle}
                          className="px-3 py-1.5 text-xs text-secondary hover:bg-hover hover:text-primary transition-colors cursor-pointer outline-none flex items-center gap-1.5"
                        >
                          <PushPinIcon size={11} weight={isPinned ? 'fill' : 'regular'} />
                          {isPinned ? 'Unpin' : 'Pin'}
                        </DropdownMenu.Item>
                      )}

                      {(isOwner || isAdmin) && (
                        <DropdownMenu.Item
                          onClick={() => setConfirmingDelete(true)}
                          className="px-3 py-1.5 text-xs text-accent hover:bg-hover transition-colors cursor-pointer outline-none flex items-center gap-1.5"
                        >
                          <TrashIcon size={11} /> Delete
                        </DropdownMenu.Item>
                      )}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {/* Inline delete confirm */}
                {confirmingDelete && (
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-secondary">Delete?</span>
                    <button onClick={handleDelete} className="text-accent hover:text-accent-hover">Yes</button>
                    <button onClick={() => setConfirmingDelete(false)} className="text-secondary hover:text-primary">No</button>
                  </span>
                )}
              </div>

              {/* Reply editor */}
              {showReply && (
                <div className="mt-2 ml-1 pl-3 border-l-2 border-default/50">
                  <CommentEditor
                    onSubmit={handleReplySubmit}
                    onCancel={() => setShowReply(false)}
                    placeholder={`Reply to ${comment.userName}...`}
                    compact
                    isLoggedIn={!!user}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <RevisionHistoryModal
        commentId={comment.id}
        open={showRevisions}
        onOpenChange={setShowRevisions}
      />
      <ReportCommentModal
        commentId={comment.id}
        open={showReport}
        onOpenChange={setShowReport}
      />
    </div>
  );
}
