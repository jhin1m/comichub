'use client';

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { HeartIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { useUserSWR } from '@/lib/swr/use-user-swr';
import { SWR_KEYS } from '@/lib/swr/swr-keys';
import { bookmarkApi } from '@/lib/api/bookmark.api';
import { getMangaUrl } from '@/lib/utils/manga-url';
import {
  MediaStrip,
  MediaStripSkeleton,
  type MediaStripItem,
} from './media-strip';
import type { BookmarkItem } from '@/types/bookmark.types';

interface BookmarkResponse {
  data: BookmarkItem[];
}

export function FollowListStrip() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [removing, setRemoving] = useState<number | null>(null);

  const shouldRender = Boolean(user) && user?.hasBookmark === true;

  const { data, isLoading } = useUserSWR<BookmarkResponse>(
    shouldRender ? SWR_KEYS.USER_BOOKMARK_STRIP : null,
  );

  if (!shouldRender) return null;
  if (isLoading && !data) return <MediaStripSkeleton />;
  if (!data?.data.length) return null;

  const items: MediaStripItem[] = data.data.map((entry) => ({
    id: entry.id,
    mangaId: entry.mangaId,
    href: entry.readingProgress?.currentChapterId
      ? `${getMangaUrl(entry.manga)}/${entry.readingProgress.currentChapterId}`
      : getMangaUrl(entry.manga),
    cover: entry.manga.cover,
    title: entry.manga.title,
    subtitle: entry.readingProgress?.currentChapter
      ? `Ch.${entry.readingProgress.currentChapter}`
      : 'Not started',
    cta: entry.readingProgress?.currentChapter ? 'Resume →' : 'Start →',
  }));

  const handleRemove = async (mangaId: number) => {
    if (removing) return;
    setRemoving(mangaId);
    const prev = data;
    mutate(
      SWR_KEYS.USER_BOOKMARK_STRIP,
      { data: data.data.filter((x) => x.mangaId !== mangaId) },
      false,
    );
    try {
      await bookmarkApi.removeBookmark(mangaId);
      toast.success('Removed from bookmarks');
    } catch {
      mutate(SWR_KEYS.USER_BOOKMARK_STRIP, prev, false);
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <MediaStrip
      title="Follow List"
      icon={<HeartIcon size={18} className="text-accent" />}
      viewAllHref="/profile?tab=follows"
      viewAllLabel="View All"
      removeAriaLabel="Remove from follow list"
      items={items}
      removingId={removing}
      onRemove={handleRemove}
      testId="follow-list-strip"
    />
  );
}
