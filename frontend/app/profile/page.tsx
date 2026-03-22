'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth.context';
import { userApi } from '@/lib/api/user.api';
import { ProfileHeader } from '@/components/profile/profile-header';
import { HistoryTab } from '@/components/profile/history-tab';
import { FollowsTab } from '@/components/profile/follows-tab';
import PageWrapper from '@/components/layout/page-wrapper';
import type { MyProfile, HistoryItem, FollowItem } from '@/types/user.types';
import type { PaginatedResult } from '@/types/manga.types';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [history, setHistory] = useState<PaginatedResult<HistoryItem> | null>(null);
  const [follows, setFollows] = useState<PaginatedResult<FollowItem> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user) {
      Promise.all([userApi.getMe(), userApi.getHistory(), userApi.getFollows()])
        .then(([p, h, f]) => {
          setProfile(p);
          setHistory(h);
          setFollows(f);
        })
        .catch(() => {
          router.replace('/login');
        });
    }
  }, [user, authLoading, router]);

  if (authLoading || !profile) {
    return (
      <PageWrapper className="py-8">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-hover" />
            <div className="space-y-2">
              <div className="h-5 w-32 bg-hover rounded" />
              <div className="h-4 w-48 bg-hover rounded" />
            </div>
          </div>
          <div className="h-10 w-64 bg-hover rounded mt-8" />
          <div className="space-y-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-hover rounded" />
            ))}
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="py-8">
      <ProfileHeader profile={profile} />
      <div className="mt-8">
        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history">
              History ({history?.total ?? 0})
            </TabsTrigger>
            <TabsTrigger value="following">
              Following ({follows?.total ?? 0})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="history">
            <HistoryTab items={history?.data ?? []} />
          </TabsContent>
          <TabsContent value="following">
            <FollowsTab items={follows?.data ?? []} />
          </TabsContent>
        </Tabs>
      </div>
    </PageWrapper>
  );
}
