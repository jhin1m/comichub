import Image from 'next/image';
import Link from 'next/link';
import { ChatCircle } from '@phosphor-icons/react/ssr';
import { formatRelativeDate } from '@/lib/utils';
import { stripHtml } from '@/lib/utils/strip-html';
import type { RecentComment } from '@/lib/api/comment.api';

function CommentItem({ comment }: { comment: RecentComment }) {
  const chapterLabel = comment.chapterNumber
    ? `CHAPTER ${comment.chapterNumber}`
    : null;
  const heading = [chapterLabel, comment.mangaTitle?.toUpperCase()].filter(Boolean).join(' - ');
  const href = comment.mangaSlug ? `/manga/${comment.mangaSlug}?cmid=${comment.id}` : '#';

  return (
    <Link href={href} className="block py-3.5 group">
      {/* Header: cover overlaps left edge of dark bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative w-7 h-7 shrink-0 rounded overflow-hidden bg-surface z-10">
          {comment.mangaCover ? (
            <Image
              src={comment.mangaCover}
              alt={comment.mangaTitle ?? ''}
              fill
              className="object-cover"
              sizes="28px"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-hover" />
          )}
        </div>
        <span className="text-[11px] tracking-wide text-secondary bg-elevated rounded-md px-3 py-1.5 truncate min-w-0 flex-1 group-hover:text-accent transition-colors duration-150">
          {heading || 'Unknown'}
        </span>
      </div>

      {/* Comment content */}
      <p className="text-[13px] text-primary leading-relaxed line-clamp-2 mb-1.5">
        {stripHtml(comment.content).trim()}
      </p>

      {/* User + time */}
      <div className="flex items-center justify-between text-xs text-muted font-rajdhani">
        <span className="truncate max-w-[60%]">{comment.userName}</span>
        <span className="shrink-0" suppressHydrationWarning>{formatRelativeDate(comment.createdAt)}</span>
      </div>
    </Link>
  );
}

interface Props {
  comments: RecentComment[];
}

export function LatestComments({ comments }: Props) {
  if (comments.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="font-rajdhani font-bold text-xl text-primary mb-2">
        Latest Comments
      </h2>
      <div className="divide-y divide-default">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
}
