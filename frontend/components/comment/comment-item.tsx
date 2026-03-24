'use client';

import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ThumbsUpIcon, ThumbsDownIcon, ArrowBendUpLeftIcon, DotsThreeOutlineIcon, PencilSimpleIcon, TrashIcon, LinkSimpleIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { CommentEditor } from './comment-editor';
import { commentApi } from '@/lib/api/comment.api';
import { useAuth } from '@/contexts/auth.context';
import type { Comment } from '@/types/comment.types';
import { cn } from '@/lib/utils';

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

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
  onCommentAdded?: () => void;
  onCommentDeleted?: (commentId: number) => void;
  depth?: number;
  highlighted?: boolean;
}

export function CommentItem({
  comment,
  commentableType,
  commentableId,
  onCommentAdded,
  onCommentDeleted,
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
  const [deleted, setDeleted] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [flash, setFlash] = useState(highlighted);

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
    await commentApi.create({ commentableType, commentableId, content: html, parentId: comment.id });
    setShowReply(false);
    onCommentAdded?.();
    toast.success('Reply posted');
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
    try {
      await commentApi.remove(comment.id);
      setDeleted(true);
      onCommentDeleted?.(comment.id);
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?cmid=${comment.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  if (deleted) return null;

  const hasMenuItems = isOwner || isAdmin;

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
          {/* Header: name + role badge + time + collapse */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-primary font-semibold text-xs">{comment.userName}</span>
              <RoleBadge role={comment.userRole} />
              <span className="text-muted text-[11px]" title={new Date(comment.createdAt).toLocaleString()}>
                {timeAgo(comment.createdAt)}
              </span>
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand comment' : 'Collapse comment'}
              className="text-muted hover:text-primary text-xs font-mono leading-none transition-colors px-1"
            >
              {collapsed ? '+' : '–'}
            </button>
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
                  className="text-primary text-xs leading-relaxed mt-0.5 prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
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

                {depth < 3 && (
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
                      className="bg-elevated border border-default rounded-md shadow-lg py-1 z-50 min-w-[120px] animate-in fade-in-0 zoom-in-95"
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
    </div>
  );
}
