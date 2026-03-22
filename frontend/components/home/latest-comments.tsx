import Image from 'next/image';
import Link from 'next/link';
import { formatRelativeDate } from '@/lib/utils';
import type { RecentComment } from '@/lib/api/comment.api';

function CommentItem({ comment }: { comment: RecentComment }) {
  const chapterLabel = comment.chapterNumber
    ? `Chapter ${comment.chapterNumber}`
    : null;
  const heading = [chapterLabel, comment.mangaTitle].filter(Boolean).join(' - ');
  const href = comment.mangaSlug ? `/manga/${comment.mangaSlug}` : '#';

  return (
    <div className="py-2.5 border-b border-[#1e1e1e] last:border-0">
      {/* Chapter/Manga header */}
      <Link
        href={href}
        className="flex items-center gap-2 mb-1.5 group cursor-pointer"
      >
        {/* Manga cover thumbnail */}
        <div className="relative w-7 h-7 shrink-0 rounded-[3px] overflow-hidden bg-elevated border border-[#2a2a2a]">
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
            <div className="w-full h-full bg-[#2a2a2a]" />
          )}
        </div>
        <span className="text-[11px] font-medium text-[#a0a0a0] bg-[#1a1a1a] px-2 py-0.5 rounded-sm line-clamp-1 flex-1 group-hover:text-accent transition-colors duration-150">
          {heading || 'Unknown'}
        </span>
      </Link>

      {/* Comment content */}
      <p className="text-[12px] text-[#d0d0d0] leading-relaxed line-clamp-2 mb-1">
        {comment.content}
      </p>

      {/* User info + time */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#a0a0a0] truncate max-w-[60%]">
          {comment.userName}
        </span>
        <span className="text-[#5a5a5a] shrink-0">
          {formatRelativeDate(comment.createdAt)}
        </span>
      </div>
    </div>
  );
}

interface Props {
  comments: RecentComment[];
}

export function LatestComments({ comments }: Props) {
  if (comments.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-3 pb-2.5 border-b border-[#2a2a2a]">
        <h2 className="font-rajdhani font-bold text-[17px] text-[#f5f5f5]">
          Latest Comments
        </h2>
      </div>
      {comments.map((comment) => (
        <CommentItem key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
