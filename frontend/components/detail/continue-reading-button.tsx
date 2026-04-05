'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlayIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth.context';
import { userApi } from '@/lib/api/user.api';

interface Props {
  mangaId: number;
  mangaSlug: string;
  firstChapterId?: number;
}

/**
 * Smart CTA: shows "Continue Ch.X" for returning users,
 * falls back to "Start Reading" for new users / guests.
 */
export function ContinueReadingButton({ mangaId, mangaSlug, firstChapterId }: Props) {
  const { user } = useAuth();
  const [lastRead, setLastRead] = useState<{ chapterId: number; chapterNumber?: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    userApi.getLastRead(mangaId)
      .then((res) => {
        if (res?.chapterId) setLastRead({ chapterId: res.chapterId });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user, mangaId]);

  // Not loaded yet — show placeholder to prevent CLS
  if (!loaded) {
    return (
      <div className="h-10 w-36 rounded-md bg-elevated animate-pulse" />
    );
  }

  // User has reading history — show continue + start from ch.1
  if (lastRead) {
    return (
      <>
        <Link href={`/manga/${mangaSlug}/${lastRead.chapterId}`}>
          <Button variant="primary" className="gap-2 font-rajdhani font-bold tracking-wide">
            <PlayIcon size={16} weight="fill" />
            Continue Reading
          </Button>
        </Link>
        {firstChapterId && firstChapterId !== lastRead.chapterId && (
          <Link href={`/manga/${mangaSlug}/${firstChapterId}`}>
            <Button variant="secondary" className="gap-2 font-rajdhani font-bold tracking-wide">
              Ch.1
            </Button>
          </Link>
        )}
      </>
    );
  }

  // No history — default start reading
  if (!firstChapterId) return null;
  return (
    <Link href={`/manga/${mangaSlug}/${firstChapterId}`}>
      <Button variant="primary" className="gap-2 font-rajdhani font-bold tracking-wide">
        <PlayIcon size={16} weight="fill" />
        Start Reading
      </Button>
    </Link>
  );
}
