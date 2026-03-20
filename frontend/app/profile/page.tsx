'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PixelTabs } from '@pxlkit/ui-kit';
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

  if (authLoading || !profile) return null;

  return (
    <PageWrapper className="py-8">
      <ProfileHeader profile={profile} />
      <div className="mt-8">
        <PixelTabs
          items={[
            {
              id: 'history',
              label: `History (${history?.total ?? 0})`,
              content: <HistoryTab items={history?.data ?? []} />,
            },
            {
              id: 'following',
              label: `Following (${follows?.total ?? 0})`,
              content: <FollowsTab items={follows?.data ?? []} />,
            },
          ]}
        />
      </div>
    </PageWrapper>
  );
}
