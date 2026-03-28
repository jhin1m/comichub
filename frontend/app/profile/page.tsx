'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth.context';
import { userApi } from '@/lib/api/user.api';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { ProfileHeader } from '@/components/profile/profile-header';
import { HistoryTab } from '@/components/profile/history-tab';
import { BookmarkListTab } from '@/components/bookmark/bookmark-list-tab';
import { ImportTab } from '@/components/bookmark/import-tab';
import { ExportTab } from '@/components/bookmark/export-tab';
import { FolderManagerTab } from '@/components/bookmark/folder-manager-tab';
import PageWrapper from '@/components/layout/page-wrapper';
import type { MyProfile, HistoryItem } from '@/types/user.types';
import type { PaginatedResult } from '@/types/manga.types';
import type { BookmarkFolder } from '@/types/bookmark.types';

const TABS = ['profile', 'bookmarks', 'history', 'import', 'export', 'folders'] as const;
type TabValue = (typeof TABS)[number];

function ProfileSkeleton() {
  return (
    <PageWrapper className="py-8">
      <div className="animate-pulse space-y-6">
        {/* Tab bar skeleton */}
        <div className="flex gap-4 border-b border-default pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-16 bg-hover rounded" />
          ))}
        </div>
        {/* Profile header skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-hover" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-36 bg-hover rounded" />
            <div className="h-4 w-48 bg-hover rounded" />
            <div className="h-3 w-24 bg-hover rounded" />
          </div>
        </div>
        {/* Table rows skeleton */}
        <div className="space-y-0">
          <div className="h-8 bg-hover/50 rounded-t" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-default">
              <div className="w-10 h-14 bg-hover rounded shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-3/4 bg-hover rounded" />
                <div className="h-3 w-1/3 bg-hover rounded" />
              </div>
              <div className="h-3 w-12 bg-hover rounded" />
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}

function ProfileContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [history, setHistory] = useState<PaginatedResult<HistoryItem> | null>(null);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);

  const rawTab = searchParams.get('tab') ?? 'profile';
  const tab: TabValue = TABS.includes(rawTab as TabValue) ? (rawTab as TabValue) : 'profile';

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user) {
      Promise.allSettled([userApi.getMe(), userApi.getHistory()])
        .then(([p, h]) => {
          if (p.status === 'fulfilled') setProfile(p.value);
          else { router.replace('/login'); return; }
          if (h.status === 'fulfilled') setHistory(h.value);
        });
    }
  }, [user, authLoading, router]);

  const loadFolders = useCallback(() => {
    bookmarkApi.getFolders().then(setFolders).catch(() => setFolders([]));
  }, []);

  useEffect(() => {
    if (user) loadFolders();
  }, [user, loadFolders]);

  function handleTabChange(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('tab', value);
    if (value !== 'bookmarks') {
      ['page', 'search', 'folderId', 'sortBy', 'sortOrder'].forEach((k) => sp.delete(k));
    }
    router.push(`${pathname}?${sp.toString()}`);
  }

  function handleHistoryRemoved(mangaId: number) {
    setHistory((prev) => {
      if (!prev) return prev;
      const filtered = prev.data.filter((item) => item.mangaId !== mangaId);
      return { ...prev, data: filtered, total: Math.max(0, prev.total - (prev.data.length - filtered.length)) };
    });
  }

  if (authLoading || !profile) return <ProfileSkeleton />;

  return (
    <PageWrapper className="py-8">
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="folders">Folders</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileHeader profile={profile} />
        </TabsContent>

        <TabsContent value="bookmarks">
          <BookmarkListTab folders={folders} onFolderChanged={loadFolders} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab items={history?.data ?? []} onRemoved={handleHistoryRemoved} />
        </TabsContent>

        <TabsContent value="import">
          <ImportTab />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab folders={folders} />
        </TabsContent>

        <TabsContent value="folders">
          <FolderManagerTab folders={folders} onFoldersChanged={loadFolders} />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}
