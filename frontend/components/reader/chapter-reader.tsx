'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { userApi } from '@/lib/api/user.api';
import { useAuth } from '@/contexts/auth.context';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import { useReaderKeyboard } from '@/hooks/use-reader-keyboard';
import { usePageTracker } from '@/hooks/use-page-tracker';
import { useAutoHide } from '@/hooks/use-auto-hide';
import { ReaderTopBar } from '@/components/reader/reader-top-bar';
import { ReaderBottomBar } from '@/components/reader/reader-bottom-bar';
import { ReaderImage } from '@/components/reader/reader-image';
import { ReaderProgressBar } from '@/components/reader/reader-progress-bar';
import { ReaderZoomControls } from '@/components/reader/reader-zoom-controls';
import { ReaderSidebar } from '@/components/reader/reader-sidebar';
import { ReaderSettingsModal } from '@/components/reader/reader-settings-modal';
import { ChapterEndScreen } from '@/components/reader/chapter-end-screen';
import type { ChapterWithImages, ChapterNavigation, TaxonomyItem } from '@/types/manga.types';

interface Props {
  chapter: ChapterWithImages;
  nav: ChapterNavigation;
  slug: string;
  mangaTitle: string;
}

export function ChapterReader({ chapter, nav, slug, mangaTitle }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { settings, update, imageFilterStyle } = useReaderSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nsfwDismissed, setNsfwDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'chapters' | 'comments' | 'settings' | null>(null);

  // ─── Responsive (suppress transition on first mount) ───
  useEffect(() => {
    const isDesktop = window.innerWidth >= 768;
    setIsMobile(!isDesktop);
    setSidebarOpen(isDesktop);
    requestAnimationFrame(() => setMounted(true));
    let timer: ReturnType<typeof setTimeout>;
    const check = () => { clearTimeout(timer); timer = setTimeout(() => setIsMobile(window.innerWidth < 768), 150); };
    window.addEventListener('resize', check);
    return () => { window.removeEventListener('resize', check); clearTimeout(timer); };
  }, []);

  // ─── Group selection ───────────────────────────────────
  const chapterGroups: TaxonomyItem[] = chapter.groups ?? [];
  useEffect(() => {
    const groups = chapter.groups ?? [];
    if (groups.length <= 1) { setSelectedGroupId(groups[0]?.id ?? null); return; }
    const stored = localStorage.getItem(`comichub:preferred-group:${chapter.mangaId}`);
    const storedId = stored ? Number(stored) : null;
    const match = storedId && groups.find((g) => g.id === storedId);
    setSelectedGroupId(match ? storedId : groups[0]?.id ?? null);
  }, [chapter.id, chapter.mangaId, chapter.groups]);

  const handleGroupSelect = useCallback((groupId: number | null) => {
    setSelectedGroupId(groupId);
    if (groupId != null) localStorage.setItem(`comichub:preferred-group:${chapter.mangaId}`, String(groupId));
    scrollRef.current?.scrollTo(0, 0);
  }, [chapter.mangaId]);

  // ─── Filtered + sorted images ──────────────────────────
  const sortedImages = useMemo(() => {
    const filtered = chapter.images.filter((img) => {
      if (!selectedGroupId) return true;
      if (img.groupId == null) return true;
      return img.groupId === selectedGroupId;
    });
    return [...filtered].sort((a, b) => a.order - b.order);
  }, [chapter.images, selectedGroupId]);

  // Only use manual mode after mount (prevents hydration mismatch)
  const isManualMode = mounted && settings.displayMode !== 'longstrip';

  const { currentPage, setCurrentPage, setImageRef, goToPage } = usePageTracker({
    scrollRef, totalPages: sortedImages.length, manualMode: isManualMode,
  });

  const topBarHidden = useAutoHide(scrollRef, !isManualMode);

  // ─── Track reading history ─────────────────────────────
  useEffect(() => {
    if (user) userApi.upsertHistory(chapter.mangaId, chapter.id).catch(() => {});
  }, [chapter.id, chapter.mangaId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    setCurrentPage(1);
  }, [chapter.id, setCurrentPage]);

  // ─── Fullscreen ────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Navigation helpers ────────────────────────────────
  const goToPrevChapter = useCallback(() => {
    if (nav?.prev) router.push(`/manga/${slug}/${nav.prev.id}`);
  }, [nav, slug, router]);

  const goToNextChapter = useCallback(() => {
    if (nav?.next) router.push(`/manga/${slug}/${nav.next.id}`);
  }, [nav, slug, router]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    if (isManualMode) {
      setCurrentPage((p) => Math.max(1, Math.min(sortedImages.length, p + direction)));
    } else {
      const h = scrollRef.current?.clientHeight ?? 600;
      scrollRef.current?.scrollBy({ top: direction * h * 0.85, behavior: 'smooth' });
    }
  }, [isManualMode, setCurrentPage, sortedImages.length]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  // ─── Keyboard shortcuts (stable ref to avoid listener churn) ─
  const onExit = useCallback(() => {
    if (settingsOpen) setSettingsOpen(false); else router.push(`/manga/${slug}`);
  }, [settingsOpen, router, slug]);

  const keyboardActions = useMemo(() => ({
    onPrevChapter: goToPrevChapter,
    onNextChapter: goToNextChapter,
    onPrevPage: () => scrollByPage(-1),
    onNextPage: () => scrollByPage(1),
    onToggleFullscreen: toggleFullscreen,
    onExit,
  }), [goToPrevChapter, goToNextChapter, scrollByPage, toggleFullscreen, onExit]);

  useReaderKeyboard(keyboardActions, !settingsOpen);

  // ─── Swipe gestures (single/double page) ───────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isManualMode) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isManualMode || !touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      const isRtl = settings.readingDirection === 'rtl';
      if (dx > 0) scrollByPage(isRtl ? 1 : -1);
      else scrollByPage(isRtl ? -1 : 1);
    }
    touchStart.current = null;
  };

  // ─── Mobile panel toggle ───────────────────────────────
  const handleMobilePanel = useCallback((panel: typeof mobilePanel) => {
    if (panel === 'settings') { setSettingsOpen((v) => !v); setMobilePanel(null); return; }
    if (panel === 'chapters' || panel === 'comments') { setSidebarOpen(true); setMobilePanel(panel); return; }
    setSidebarOpen(false); setMobilePanel(null);
  }, []);

  // ─── Preload next chapter ──────────────────────────────
  useEffect(() => {
    if (!nav?.next) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = `/manga/${slug}/${nav.next.id}`;
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [nav, slug]);

  // ─── Fit mode + width styles ───────────────────────────
  const readerWidth = isMobile ? '100%' : `${settings.zoom}vw`;

  const fitClass = useMemo(() => {
    if (isManualMode) {
      // Single/double: constrain to viewport so long images don't overflow
      if (settings.fitMode === 'height') return 'max-h-[calc(100vh-7rem)] w-auto mx-auto object-contain';
      if (settings.fitMode === 'original') return 'w-auto h-auto mx-auto';
      return 'w-full h-auto'; // width (default)
    }
    // Longstrip
    if (settings.fitMode === 'height') return 'max-h-screen w-auto mx-auto';
    if (settings.fitMode === 'original') return 'w-auto h-auto mx-auto';
    return ''; // width — handled by container
  }, [settings.fitMode, isManualMode]);

  // Pages visible in current display mode
  const visiblePages = useMemo(() => {
    if (!isManualMode) return sortedImages;
    if (settings.displayMode === 'double') {
      const idx = currentPage - 1;
      return sortedImages.slice(idx, idx + 2);
    }
    return sortedImages.slice(currentPage - 1, currentPage);
  }, [isManualMode, settings.displayMode, sortedImages, currentPage]);

  const canGoPrev = isManualMode && currentPage > 1;
  const canGoNext = isManualMode && currentPage < sortedImages.length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      <ReaderProgressBar position={settings.progressPosition} scrollRef={scrollRef} />

      {!nsfwDismissed && (chapter.contentRating === 'erotica' || chapter.contentRating === 'pornographic') && (
        <div className="fixed top-12 left-0 right-0 z-40 flex items-center justify-center px-4 py-2 bg-accent/90 backdrop-blur-sm text-white text-sm font-medium">
          <span>This chapter contains mature (18+) content</span>
          <button
            onClick={() => setNsfwDismissed(true)}
            className="ml-3 px-2 py-0.5 rounded text-xs bg-white/20 hover:bg-white/30 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col">
        <ReaderTopBar
          mangaTitle={mangaTitle} slug={slug} chapterNumber={chapter.number}
          currentPage={currentPage} totalPages={sortedImages.length}
          sidebarOpen={sidebarOpen} hidden={topBarHidden}
          isFullscreen={isFullscreen}
          onToggleSidebar={toggleSidebar} onToggleFullscreen={toggleFullscreen}
        />

        {/* Scrollable image area */}
        <div
          ref={scrollRef}
          className={`flex-1 overflow-y-auto pt-12 ${mounted ? 'transition-[padding] duration-300 ease-in-out' : ''}`}
          style={{
            paddingRight: !isMobile && sidebarOpen ? 380 : 0,
            paddingBottom: isMobile ? 56 : 0,
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Images */}
          <div
            className={`mx-auto ${isManualMode && settings.displayMode === 'double' ? 'flex gap-1 justify-center items-start' : ''} ${isManualMode ? 'flex flex-col items-center justify-center min-h-[calc(100vh-7rem)]' : ''}`}
            style={isManualMode ? undefined : { width: readerWidth, maxWidth: '100%' }}
          >
            {!isManualMode ? (
              // Long strip — all images
              sortedImages.map((img, i) => (
                <div key={img.id} ref={setImageRef(i)} className={fitClass} style={{ marginBottom: i < sortedImages.length - 1 ? `${settings.stripMargin}px` : 0 }}>
                  <ReaderImage src={img.imageUrl} alt={`Page ${img.pageNumber}`} filterStyle={imageFilterStyle} />
                </div>
              ))
            ) : (
              // Single or Double — visible pages only
              <div className={settings.displayMode === 'double' ? 'flex gap-1 justify-center items-start max-w-full' : 'max-w-full'} style={{ width: readerWidth, maxWidth: '100%' }}>
                {visiblePages.map((img) => (
                  <div key={img.id} className={`${settings.displayMode === 'double' ? 'flex-1 max-w-[50%]' : ''} ${fitClass}`}>
                    <ReaderImage src={img.imageUrl} alt={`Page ${img.pageNumber}`} filterStyle={imageFilterStyle} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prev / Next page nav buttons (single/double mode, RTL-aware) */}
          {isManualMode && (() => {
            const isRtl = settings.readingDirection === 'rtl';
            const leftAction = isRtl ? 1 : -1;
            const rightAction = isRtl ? -1 : 1;
            const canLeft = isRtl ? canGoNext : canGoPrev;
            const canRight = isRtl ? canGoPrev : canGoNext;
            return (
              <div className="fixed inset-y-0 left-0 right-0 z-20 pointer-events-none flex items-center justify-between px-2 md:px-4" style={{ top: 48, bottom: isMobile ? 56 : 0 }}>
                <button
                  onClick={() => scrollByPage(leftAction as 1 | -1)}
                  disabled={!canLeft}
                  aria-label={isRtl ? 'Next page' : 'Previous page'}
                  className={`pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                    canLeft ? 'bg-base/70 hover:bg-base/90 text-primary backdrop-blur-sm' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <CaretLeftIcon size={24} />
                </button>
                <button
                  onClick={() => scrollByPage(rightAction as 1 | -1)}
                  disabled={!canRight}
                  aria-label={isRtl ? 'Previous page' : 'Next page'}
                  className={`pointer-events-auto w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                    canRight ? 'bg-base/70 hover:bg-base/90 text-primary backdrop-blur-sm' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <CaretRightIcon size={24} />
                </button>
              </div>
            );
          })()}

          {/* Chapter end screen */}
          {(!isManualMode || currentPage >= sortedImages.length) && (
            <ChapterEndScreen chapterNumber={chapter.number} totalPages={sortedImages.length} nav={nav} mangaSlug={slug} />
          )}

          {!isManualMode && <div className="h-16" />}
        </div>

        <ReaderZoomControls
          zoom={settings.zoom} onZoomChange={(z) => update('zoom', z)}
          onSettingsClick={() => setSettingsOpen(true)}
          scrollRef={scrollRef} isMobile={isMobile}
        />

        {isMobile && (
          <ReaderBottomBar
            hasPrev={!!nav?.prev} hasNext={!!nav?.next}
            activePanel={mobilePanel}
            onPrev={goToPrevChapter} onNext={goToNextChapter}
            onTogglePanel={handleMobilePanel}
          />
        )}
      </div>

      {/* Sidebar */}
      <div className={`absolute top-0 right-0 h-full z-50 ${mounted ? 'transition-transform duration-300 ease-in-out' : ''} ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <ReaderSidebar
          chapter={chapter} nav={nav} mangaSlug={slug} mangaTitle={mangaTitle}
          onClose={toggleSidebar}
          selectedGroupId={selectedGroupId} onGroupSelect={handleGroupSelect}
        />
      </div>

      <ReaderSettingsModal
        open={settingsOpen} onClose={() => setSettingsOpen(false)}
        settings={settings} onUpdate={update}
      />
    </div>
  );
}
