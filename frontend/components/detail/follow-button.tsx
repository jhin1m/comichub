'use client';
import { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (!user) return;
    mangaApi.isFollowed(mangaId).then((res) => {
      // community follow service returns { following }, user follow service returns { followed }
      setIsFollowing(res.followed ?? res.following ?? false);
    }).catch(() => {});
  }, [user, mangaId]);

  const handleToggle = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    try {
      const res = await mangaApi.toggleFollow(mangaId);
      setIsFollowing(res.followed);
      setCount(res.followersCount ?? (isFollowing ? count - 1 : count + 1));
      toast.success(res.followed ? 'Followed successfully' : 'Unfollowed');
    } catch {
      toast.error('Failed to update follow status');
    }
  };

  return (
    <Button variant="secondary" onClick={handleToggle}>
      {isFollowing ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      {isFollowing ? 'Following' : 'Follow'} ({count})
    </Button>
  );
}
