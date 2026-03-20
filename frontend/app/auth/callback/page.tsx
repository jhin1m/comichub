'use client';
import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';

function AuthCallbackContent() {
  const { setTokensFromOAuth } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    if (accessToken && refreshToken) {
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
      <p className="text-[#a0a0a0]">Completing sign in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#a0a0a0]">Completing sign in...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
