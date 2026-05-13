'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';

const RECONNECT_DELAY_MS = 3000;

/**
 * Subscribe to server-sent comment events for a manga or chapter.
 * Calls `onNewComment` whenever a new comment event arrives (skips heartbeats
 * and events authored by the current user).
 * Pauses when the tab is hidden; reconnects when it becomes visible again.
 */
export function useCommentStream(
  type: 'manga' | 'chapter',
  id: number,
  onNewComment: () => void,
) {
  const { user } = useAuth();
  const onNewCommentRef = useRef(onNewComment);
  onNewCommentRef.current = onNewComment;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
    const url = `${apiBase}/comments/stream?type=${type}&id=${id}`;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed || document.hidden) return;

      // No `withCredentials` — the SSE endpoint is `@Public()` and our auth
      // model is Bearer JWT (not cookies). Enabling credentials served no
      // purpose and forced unnecessary CORS preflight constraints.
      es = new EventSource(url);

      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const payload = JSON.parse(event.data as string) as { type?: string; authorId?: number };
          if (payload.type === 'heartbeat') return;
          // Skip events authored by current user — they already see their comment
          if (user?.id && payload.authorId === user.id) return;
          onNewCommentRef.current();
        } catch {
          // Malformed event — ignore
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!destroyed) {
          reconnectTimer = setTimeout(() => {
            if (!destroyed && !document.hidden) connect();
          }, RECONNECT_DELAY_MS);
        }
      };
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        es?.close();
        es = null;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      } else {
        connect();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    connect();

    return () => {
      destroyed = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, user?.id]);
}
