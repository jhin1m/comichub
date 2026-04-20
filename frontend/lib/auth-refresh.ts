import axios from 'axios';
import { setAccessToken } from '@/lib/api-client';

const BASE_URL =
  (typeof window === 'undefined' ? process.env.INTERNAL_API_URL : undefined) ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:8080/api/v1';

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

// Shared in-flight promise: any concurrent caller (restoreSession, 401 retry
// interceptor, future callers) awaits the SAME POST /auth/refresh. Prevents
// the H3 reuse-detection race where two parallel refreshes present the same
// rotated token → backend nukes the session.
let inFlight: Promise<RefreshedTokens> | null = null;

export function refreshTokens(): Promise<RefreshedTokens> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const refreshToken =
      typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    if (!refreshToken) throw new Error('No refresh token');

    const { data: envelope } = await axios.post(`${BASE_URL}/auth/refresh`, {
      refreshToken,
    });
    const tokens = (envelope?.data ?? envelope) as RefreshedTokens;
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new Error('Invalid token response');
    }

    setAccessToken(tokens.accessToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
    return tokens;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
