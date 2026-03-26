'use client';

import { useEffect, useRef, useCallback } from 'react';
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';
import { useAuth } from '@/contexts/auth.context';
import { getAccessToken } from '@/lib/api-client';
import type { SseNotificationEvent } from '@/lib/notification-types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

class RetriableError extends Error {}

export function useNotificationStream(
  onEvent: (data: SseNotificationEvent) => void,
) {
  const { user } = useAuth();
  const abortRef = useRef<AbortController | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!user) return;

    // Clean up previous connection
    abortRef.current?.abort();

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetchEventSource(`${BASE_URL}/notifications/stream`, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      openWhenHidden: true,
      onopen: async (response) => {
        if (response.ok && response.headers.get('content-type')?.includes(EventStreamContentType)) {
          return;
        }
        // 401 = token expired, retry will pick up fresh token from getAccessToken()
        if (response.status === 401) {
          throw new RetriableError();
        }
      },
      onmessage(ev) {
        if (!ev.data) return;
        try {
          const parsed = JSON.parse(ev.data) as SseNotificationEvent;
          if (parsed.type !== 'heartbeat') {
            onEventRef.current(parsed);
          }
        } catch {
          // ignore malformed events
        }
      },
      onerror(err) {
        // RetriableError: library auto-retries, picking up fresh token via headers callback
        if (err instanceof RetriableError) return;
        // Other errors: also auto-retry with backoff
      },
    });
  }, [user]);

  useEffect(() => {
    connect();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [connect]);
}
