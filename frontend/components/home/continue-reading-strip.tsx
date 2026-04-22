'use client';

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { BookOpenIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { useUserSWR } from '@/lib/swr/use-user-swr';
import { SWR_KEYS } from '@/lib/swr/swr-keys';
import { userApi } from '@/lib/api/user.api';
import { getMangaUrl } from '@/lib/utils/manga-url';
import {
  MediaStrip,
  MediaStripSkeleton,
  type MediaStripItem,
} from './media-strip';
import type { HistoryItem } from '@/types/user.types';

interface HistoryResponse {
  data: HistoryItem[];
}

export function ContinueReadingStrip() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [removing, setRemoving] = useState<number | null>(null);

  // BE-first deploy: `hasHistory` is always present on /auth/me. Strict `!== true`
  // treats `false` and `undefined` identically → no render, no skeleton, no
  // network call. New users skip this branch entirely.
  const shouldRender = Boolean(user) && user?.hasHistory === true;

  const { data, isLoading } = useUserSWR<HistoryResponse>(
    shouldRender ? SWR_KEYS.USER_HISTORY_STRIP : null,
  );

  if (!shouldRender) return null;
  if (isLoading && !data) return <MediaStripSkeleton />;
  if (!data?.data.length) return null;

  const items: MediaStripItem[] = data.data.map((entry) => ({
    id: entry.id,
    mangaId: entry.mangaId,
    href: entry.chapter
      ? `${getMangaUrl(entry.manga)}/${entry.chapter.id}`
      : getMangaUrl(entry.manga),
    cover: entry.manga.cover,
    title: entry.manga.title,
    subtitle: entry.chapter ? `Ch.${entry.chapter.number}` : 'Not started',
    cta: 'Resume →',
  }));

  const handleRemove = async (mangaId: number) => {
    if (removing) return;
    setRemoving(mangaId);
    const prev = data;
    // Optimistic: drop the row from cache immediately, rollback via refetch on error.
    mutate(
      SWR_KEYS.USER_HISTORY_STRIP,
      { data: data.data.filter((x) => x.mangaId !== mangaId) },
      false,
    );
    try {
      await userApi.removeHistory(mangaId);
      toast.success('Removed from history');
    } catch {
      mutate(SWR_KEYS.USER_HISTORY_STRIP, prev, false);
      toast.error('Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <MediaStrip
      title="Continue Reading"
      icon={<BookOpenIcon size={18} className="text-accent" />}
      viewAllHref="/profile?tab=history"
      viewAllLabel="View History"
      removeAriaLabel="Remove from history"
      items={items}
      removingId={removing}
      onRemove={handleRemove}
      testId="continue-reading-strip"
    />
  );
}
