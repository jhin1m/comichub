'use client';
import { useState } from 'react';
import { PixelButton } from '@pxlkit/ui-kit';
import { mangaApi } from '@/lib/api/manga.api';
import { useAuth } from '@/contexts/auth.context';

interface Props {
  mangaId: number;
  followersCount: number;
}

export function FollowButton({ mangaId, followersCount }: Props) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [count, setCount] = useState(followersCount);

  const handleToggle = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    try {
      await mangaApi.toggleFollow(mangaId);
      setIsFollowing((f) => !f);
      setCount((c) => (isFollowing ? c - 1 : c + 1));
    } catch {
      // silent fail
    }
  };

  return (
    <PixelButton tone="neutral" onClick={handleToggle}>
      {isFollowing ? 'Unfollow' : 'Follow'} ({count})
    </PixelButton>
  );
}
