'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { mangaApi } from '@/lib/api/manga.api';

interface Props {
  mangaId: number;
  averageRating: string;
  totalRatings: number;
}

type StarState = 'full' | 'half' | 'empty';

function getStarStates(rating: number): StarState[] {
  return Array.from({ length: 5 }, (_, i) => {
    const diff = rating - i;
    if (diff >= 1) return 'full';
    if (diff >= 0.5) return 'half';
    return 'empty';
  });
}

function StarIcon({ state, size = 24, gradientId }: { state: StarState; size?: number; gradientId: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {state === 'half' && (
        <defs>
          <linearGradient id={gradientId}>
            <stop offset="50%" stopColor="var(--color-amber-400, #f59e0b)" />
            <stop offset="50%" stopColor="#404040" />
          </linearGradient>
        </defs>
      )}
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill={state === 'full' ? 'var(--color-amber-400, #f59e0b)' : state === 'half' ? `url(#${gradientId})` : '#404040'}
        stroke={state === 'empty' ? '#404040' : 'var(--color-amber-400, #f59e0b)'}
        strokeWidth="0.5"
      />
    </svg>
  );
}

export default function StarRating({ mangaId, averageRating, totalRatings }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const componentId = useId();

  const avg = parseFloat(averageRating) || 0;
  const displayScore = (avg * 2).toFixed(1);

  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeRating = hoverRating ?? userRating ?? avg;
  const starStates = getStarStates(activeRating);

  const fetchUserRating = useCallback(async () => {
    if (!user) return;
    try {
      const data = await mangaApi.getUserRating(mangaId);
      if (data.score != null) setUserRating(data.score);
    } catch {
      // silent
    }
  }, [user, mangaId]);

  useEffect(() => {
    fetchUserRating();
  }, [fetchUserRating]);

  function getScoreFromMouseEvent(e: React.MouseEvent<HTMLButtonElement>, starIndex: number): number {
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const half = e.clientX - rect.left < rect.width / 2;
    return half ? starIndex + 0.5 : starIndex + 1;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>, starIndex: number) {
    setHoverRating(getScoreFromMouseEvent(e, starIndex));
  }

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>, starIndex: number) {
    if (!user) {
      router.push('/login');
      return;
    }
    const score = getScoreFromMouseEvent(e, starIndex);
    if (submitting) return;

    if (userRating === score) {
      setSubmitting(true);
      try {
        await mangaApi.removeRating(mangaId);
        setUserRating(null);
        toast.success('Rating removed');
      } catch {
        toast.error('Failed to save rating');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await mangaApi.rate(mangaId, score);
      setUserRating(score);
      toast.success('Rating saved');
    } catch {
      toast.error('Failed to save rating');
    } finally {
      setSubmitting(false);
    }
  }

  const shownScore = hoverRating != null
    ? (hoverRating * 2).toFixed(1)
    : userRating != null
      ? (userRating * 2).toFixed(1)
      : displayScore;

  return (
    <div className="rounded-lg border border-default bg-surface/60 px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Stars */}
        <div
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHoverRating(null)}
        >
          {starStates.map((state, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Rate ${i + 1} stars`}
              className="cursor-pointer transition-transform hover:scale-110 focus:outline-none disabled:cursor-not-allowed"
              disabled={submitting}
              onMouseMove={(e) => handleMouseMove(e, i)}
              onClick={(e) => handleClick(e, i)}
            >
              <StarIcon state={state} size={24} gradientId={`${componentId}-star-${i}`} />
            </button>
          ))}
        </div>

        {/* Score */}
        <span className="font-rajdhani text-2xl font-bold leading-none text-amber-500">
          {shownScore}
        </span>
      </div>

      {/* Sub-label */}
      <p className="mt-1.5 text-sm text-muted font-rajdhani">
        Score{' '}
        <span className="font-semibold text-secondary">{displayScore}</span>
        {' · '}
        {totalRatings.toLocaleString()} ratings
        {userRating != null && (
          <span className="ml-2 text-amber-500/80">
            (yours: {(userRating * 2).toFixed(1)})
          </span>
        )}
      </p>
    </div>
  );
}
