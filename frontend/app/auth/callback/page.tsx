'use client';
import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';

function AuthCallbackContent() {
  const { restoreSession } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    if (oauth === 'success') {
      // Tokens are in HTTP-only cookies; just restore the session
      restoreSession()
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

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-secondary">Completing sign in...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
