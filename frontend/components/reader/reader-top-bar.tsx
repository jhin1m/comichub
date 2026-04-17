'use client';

import Link from 'next/link';
import {
  CaretLeftIcon,
  SidebarSimpleIcon,
} from '@phosphor-icons/react';

interface Props {
  mangaTitle: string;
  slug: string;
  chapterNumber: string;
  currentPage: number;
  totalPages: number;
  sidebarOpen: boolean;
  hidden: boolean;
  onToggleSidebar: () => void;
}

export function ReaderTopBar({
  mangaTitle,
  slug,
  chapterNumber,
  currentPage,
  totalPages,
  sidebarOpen,
  hidden,
  onToggleSidebar,
}: Props) {
  return (
    <div
      className={`absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-12 bg-base/95 backdrop-blur-sm border-b border-default/50 transition-transform duration-300 ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {/* Left — back link */}
      <Link
        href={`/manga/${slug}`}
        className="flex items-center gap-1 text-sm text-secondary hover:text-primary transition-colors"
      >
        <CaretLeftIcon size={16} />
        <span className="truncate max-w-40 md:max-w-62.5">{mangaTitle}</span>
      </Link>

      {/* Center — page indicator */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-secondary bg-elevated/80 px-2.5 py-1 rounded tabular-nums">
          {currentPage} / {totalPages}
        </span>
        <span className="text-xs text-muted hidden sm:inline">Ch. {chapterNumber}</span>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1 text-secondary">
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          className="hover:text-primary transition-colors p-1.5 rounded hover:bg-elevated/50 hidden md:flex"
        >
          <SidebarSimpleIcon size={18} />
        </button>
      </div>
    </div>
  );
}
