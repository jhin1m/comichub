'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { authApi } from '@/lib/api/auth.api';

export default function AuthCallbackPage() {
  const { setTokensFromOAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const code = query.get('code');

    // Legacy fragment flow — backend may still emit it during OAUTH_LEGACY_FRAGMENT rollout.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const legacyAccess = hashParams.get('accessToken');
    const legacyRefresh = hashParams.get('refreshToken');

    const clearUrl = () =>
      window.history.replaceState(null, '', window.location.pathname);

    if (code) {
      clearUrl();
      authApi
        .exchangeGoogleCode(code)
        .then((tokens) =>
          setTokensFromOAuth(tokens.accessToken, tokens.refreshToken),
        )
        .then(() => router.replace('/'))
        .catch(() => router.replace('/login'));
      return;
    }

    if (legacyAccess && legacyRefresh) {
      clearUrl();
      setTokensFromOAuth(legacyAccess, legacyRefresh)
        .then(() => router.replace('/'))
        .catch(() => router.replace('/login'));
      return;
    }

    router.replace('/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-secondary">Completing sign in...</p>
    </div>
  );
}
