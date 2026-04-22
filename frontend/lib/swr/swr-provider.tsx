'use client';

import { SWRConfig } from 'swr';
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
  const { user } = useAuth();

  // SWR reads provider factory once per SWRConfig identity. Keying useMemo on
  // user?.id gives a fresh cache on login/logout transitions without tearing
  // down the rest of the tree.
  const provider = useMemo(
    () => () => createSessionCache(user?.id ?? null),
    [user?.id],
  );

  return (
    <SWRConfig
      value={{
        fetcher,
        provider,
        dedupingInterval: 60_000,
        focusThrottleInterval: 60_000,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
