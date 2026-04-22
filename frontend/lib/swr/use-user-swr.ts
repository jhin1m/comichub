'use client';

import useSWR, { type SWRConfiguration } from 'swr';
import { useAuth } from '@/contexts/auth.context';

// Wrapper: auto-disable SWR when user is not logged in. Most user-scoped
// endpoints 401 without auth — passing null key to useSWR prevents the fetch.
export function useUserSWR<T>(
  key: string | null,
  config?: SWRConfiguration<T>,
) {
  const { user } = useAuth();
  return useSWR<T>(user && key ? key : null, config);
}
