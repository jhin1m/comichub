'use client';

import { SWRConfig, type SWRConfiguration } from 'swr';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { apiClient } from '@/lib/api-client';
import { createSessionCache } from './session-cache';

const fetcher = async (url: string) => {
  const res = await apiClient.get(url);
  // api-client unwraps { success, data, message } envelope into res.data = <data>
  return res.data;
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Gate provider swap on auth finishing its first hydration. Otherwise SWR
  // tears down the cache when user transitions null → <id> on restoreSession,
  // cancelling any in-flight fetches the homepage strips just kicked off.
  // Using `loading` as a gate means we keep the guest cache stable during the
  // initial load; the real user cache is attached once, after hydration.
  const userKey = loading ? 'loading' : (user?.id ?? 'guest');

  // Stabilize the entire SWRConfig value object — SWR treats a new `value`
  // reference as a reason to re-read `provider`, which swaps caches. Memoize
  // on userKey so child consumers don't see gratuitous context churn.
  const value = useMemo<SWRConfiguration>(
    () => ({
      fetcher,
      provider: () => createSessionCache(loading ? null : (user?.id ?? null)),
      dedupingInterval: 60_000,
      focusThrottleInterval: 60_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
    }),
    // We deliberately depend on userKey (string) not the raw user/loading pair
    // so that React.StrictMode double-invoke doesn't produce two distinct
    // provider instances for the same logical identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userKey],
  );

  return <SWRConfig value={value}>{children}</SWRConfig>;
}
