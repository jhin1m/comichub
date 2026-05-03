'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { userApi } from '@/lib/api/user.api';
import { useAuth } from '@/contexts/auth.context';
import { SWR_KEYS } from '@/lib/swr/swr-keys';
import type { AuthUser } from '@/types/auth.types';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import { useReaderKeyboard } from '@/hooks/use-reader-keyboard';
import { usePageTracker } from '@/hooks/use-page-tracker';
import { useAutoHide } from '@/hooks/use-auto-hide';
import { useReaderTapToggle } from '@/hooks/use-reader-tap-toggle';
import { ReaderTopBar } from '@/components/reader/reader-top-bar';
import { ReaderBottomBar } from '@/components/reader/reader-bottom-bar';
import { ReaderImage } from '@/components/reader/reader-image';

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

const TAP_TIP_KEY = 'comichub:reader-tap-tip-seen';

export function ChapterReader({ chapter, nav, slug, mangaTitle }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { settings, update, imageFilterStyle } = useReaderSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'chapters' | 'comments' | 'settings' | null>(null);
  const [barsHidden, setBarsHidden] = useState(false);

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

  const autoHideHidden = useAutoHide(scrollRef, !isMobile && !isManualMode);
  const topBarHidden = barsHidden || autoHideHidden;

  // ─── Track reading history ─────────────────────────────
  // Key on user?.id (not user obj) so auth context re-renders with a fresh user
  // object of same id don't re-fire this — would cause duplicate upsertHistory.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    userApi.upsertHistory(chapter.mangaId, chapter.id).catch(() => {});
    mutate(SWR_KEYS.USER_HISTORY_STRIP);
    mutate(
      SWR_KEYS.AUTH_ME,
      (u: AuthUser | undefined) => (u ? { ...u, hasHistory: true } : u),
      false,
    );
  }, [chapter.id, chapter.mangaId, userId, mutate]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    setCurrentPage(1);
    setBarsHidden(false);
  }, [chapter.id, setCurrentPage]);

  useEffect(() => {
    if (!isMobile) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(TAP_TIP_KEY)) return;
    toast.info('💡 Tip: Tap the image to hide/show the control bar.', { duration: 5000 });
    localStorage.setItem(TAP_TIP_KEY, '1');
  }, [isMobile]);

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
  // Esc unwinds in order: settings modal → sidebar → exit reader.
  const onExit = useCallback(() => {
    if (settingsOpen) { setSettingsOpen(false); return; }
    if (sidebarOpen) { setSidebarOpen(false); return; }
    router.push(`/manga/${slug}`);
  }, [settingsOpen, sidebarOpen, router, slug]);

  const keyboardActions = useMemo(() => ({
    onPrevChapter: goToPrevChapter,
    onNextChapter: goToNextChapter,
    onPrevPage: () => scrollByPage(-1),
    onNextPage: () => scrollByPage(1),
    onExit,
  }), [goToPrevChapter, goToNextChapter, scrollByPage, onExit]);

  useReaderKeyboard(keyboardActions, !settingsOpen);

  // ─── Touch gestures: tap toggles bars (mobile), swipe pages (manual) ───
  const handleTap = useCallback(() => setBarsHidden((v) => !v), []);
  const handleSwipeLeft = useCallback(() => {
    const isRtl = settings.readingDirection === 'rtl';
    scrollByPage(isRtl ? -1 : 1);
  }, [scrollByPage, settings.readingDirection]);
  const handleSwipeRight = useCallback(() => {
    const isRtl = settings.readingDirection === 'rtl';
    scrollByPage(isRtl ? 1 : -1);
  }, [scrollByPage, settings.readingDirection]);

  useReaderTapToggle(scrollRef, {
    enableTap: isMobile,
    enableSwipe: isMobile && isManualMode,
    onTap: handleTap,
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });

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
  const readerMaxWidth = isMobile ? '100%' : `${settings.zoom}px`;

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

      <div className="absolute inset-0 flex flex-col">
        <ReaderTopBar
          mangaTitle={mangaTitle} slug={slug} chapterNumber={chapter.number}
          currentPage={currentPage} totalPages={sortedImages.length}
          sidebarOpen={sidebarOpen} hidden={topBarHidden}
          onToggleSidebar={toggleSidebar}
        />

        {/* Scrollable image area */}
        <div
          ref={scrollRef}
          className={`flex-1 overflow-y-auto pt-12 ${mounted ? 'transition-[padding] duration-300 ease-in-out' : ''}`}
          style={{
            paddingRight: !isMobile && sidebarOpen ? 380 : 0,
            paddingBottom: isMobile ? 56 : 0,
          }}
        >
          {(chapter.contentRating === 'erotica' || chapter.contentRating === 'pornographic') && (
            <div className="flex items-center justify-center px-4 py-2 bg-accent/90 text-white text-sm font-medium">
              <span>This chapter contains mature (18+) content</span>
            </div>
          )}

          {/* Images */}
          <div
            className={`mx-auto ${isManualMode && settings.displayMode === 'double' ? 'flex gap-1 justify-center items-start' : ''} ${isManualMode ? 'flex flex-col items-center justify-center min-h-[calc(100vh-7rem)]' : ''}`}
            style={isManualMode ? undefined : { width: '100%', maxWidth: readerMaxWidth }}
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
              <div className={settings.displayMode === 'double' ? 'flex gap-1 justify-center items-start max-w-full' : 'max-w-full'} style={{ width: '100%', maxWidth: readerMaxWidth }}>
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
              <div data-reader-control className="fixed inset-y-0 left-0 right-0 z-20 pointer-events-none flex items-center justify-between px-2 md:px-4" style={{ top: 48, bottom: isMobile ? 56 : 0 }}>
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
            hidden={barsHidden}
            activePanel={mobilePanel}
            onPrev={goToPrevChapter} onNext={goToNextChapter}
            onTogglePanel={handleMobilePanel}
          />
        )}
      </div>

      {/* Sidebar backdrop (mobile) */}
      {isMobile && sidebarOpen && (
        <div className="absolute inset-0 z-[49] bg-black/50" onClick={toggleSidebar} />
      )}

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
