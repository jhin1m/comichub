'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import { CaretLeftIcon, SidebarSimpleIcon } from '@phosphor-icons/react';
import { chapterApi } from '@/lib/api/chapter.api';
import { userApi } from '@/lib/api/user.api';
import { useAuth } from '@/contexts/auth.context';
import { ReaderImage } from '@/components/reader/reader-image';
import { ReaderProgressBar } from '@/components/reader/reader-progress-bar';
import { ReaderZoomControls } from '@/components/reader/reader-zoom-controls';
import { ReaderSidebar } from '@/components/reader/reader-sidebar';
import { ReaderSettingsModal } from '@/components/reader/reader-settings-modal';
import type { DisplayMode, ProgressPosition } from '@/components/reader/reader-settings-modal';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChapterWithImages, ChapterNavigation } from '@/types/manga.types';

interface Props {
  params: Promise<{ slug: string; chapterId: string }>;
}

function formatSlugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function ChapterReaderPage({ params }: Props) {
  const { slug, chapterId } = use(params);
  const id = Number(chapterId);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [chapter, setChapter] = useState<ChapterWithImages | null>(null);
  const [nav, setNav] = useState<ChapterNavigation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zoom, setZoom] = useState(68);
  const [isMobile, setIsMobile] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('longstrip');
  const [stripMargin, setStripMargin] = useState(0);
  const [progressPosition, setProgressPosition] = useState<ProgressPosition>('left');

  const mangaTitle = formatSlugToTitle(slug);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  // Detect mobile and set responsive defaults (debounced)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150);
    };
    setIsMobile(window.innerWidth < 768);
    // Open sidebar by default on desktop only
    if (window.innerWidth >= 768) setSidebarOpen(true);
    window.addEventListener('resize', check);
    return () => { window.removeEventListener('resize', check); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setChapter(null);
    setNav(null);
    Promise.all([chapterApi.getWithImages(id), chapterApi.getNavigation(id)])
      .then(([ch, n]) => {
        setChapter(ch);
        setNav(n);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const chapterDbId = chapter?.id;
  const userId = user?.id;
  useEffect(() => {
    if (chapter && user) {
      userApi.upsertHistory(chapter.mangaId, chapter.id).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterDbId, userId]);

  // Reset scroll on chapter change
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [id]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex bg-black">
        <div className="flex-1 flex flex-col items-center gap-2 pt-20 overflow-y-auto">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="w-[700px] max-w-full h-[900px]" />
          ))}
        </div>
        <div className="hidden md:block w-[380px] bg-surface border-l border-default" />
      </div>
    );
  }

  if (!chapter) return null;

  const sortedImages = [...chapter.images].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      {/* Progress bar */}
      <ReaderProgressBar position={progressPosition} scrollRef={scrollRef} />

      {/* Reader panel — always full viewport width */}
      <div className="absolute inset-0 flex flex-col">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-12 bg-base">
          <Link
            href={`/manga/${slug}`}
            className="flex items-center gap-1 text-sm text-secondary hover:text-primary transition-colors"
          >
            <CaretLeftIcon size={16} />
            <span className="truncate max-w-[250px]">{mangaTitle}</span>
          </Link>
          <div className="flex items-center gap-3 text-secondary">
            <span className="text-xs">Ch. {chapter.number}</span>
            <button
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              className="hover:text-primary transition-colors p-1"
            >
              {sidebarOpen ? <SidebarSimpleIcon size={18} /> : <SidebarSimpleIcon size={18} />}
            </button>
          </div>
        </div>

        {/* Scrollable image area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto pt-12 transition-[padding] duration-300 ease-in-out"
          style={{ paddingRight: !isMobile && sidebarOpen ? 380 : 0 }}
        >
          {/* Mobile: 100% width. Desktop: vw-based zoom */}
          <div
            className="mx-auto"
            style={{ width: isMobile ? '100%' : `${zoom}vw`, maxWidth: '100%' }}
          >
            {sortedImages.map((img, i) => (
              <div
                key={img.id}
                style={{ marginBottom: i < sortedImages.length - 1 ? `${stripMargin}px` : 0 }}
              >
                <ReaderImage src={img.imageUrl} alt={`Page ${img.pageNumber}`} />
              </div>
            ))}
          </div>

          {/* End spacer */}
          <div className="h-32" />
        </div>

        {/* Zoom controls overlay */}
        <ReaderZoomControls
          zoom={zoom}
          onZoomChange={setZoom}
          onSettingsClick={() => setSettingsOpen(true)}
        />
      </div>

      {/* Sidebar — absolute overlay, slides from right */}
      <div
        className={`absolute top-0 right-0 h-full z-50 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <ReaderSidebar
          chapter={chapter}
          nav={nav}
          mangaSlug={slug}
          mangaTitle={mangaTitle}
          onClose={toggleSidebar}
        />
      </div>

      {/* Settings modal */}
      <ReaderSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        stripMargin={stripMargin}
        onStripMarginChange={setStripMargin}
        progressPosition={progressPosition}
        onProgressPositionChange={setProgressPosition}
      />
    </div>
  );
}
