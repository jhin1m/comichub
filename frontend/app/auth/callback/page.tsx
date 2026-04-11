'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';

export default function AuthCallbackPage() {
  const { setTokensFromOAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      // Clear tokens from URL immediately
      window.history.replaceState(null, '', window.location.pathname);
      setTokensFromOAuth(accessToken, refreshToken)
        .then(() => router.replace('/'))
        .catch(() => router.replace('/login'));
    } else {
      router.replace('/login');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-secondary">Completing sign in...</p>
    </div>
  );
}
