'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

/**
 * Wraps every /admin/* route with a role check. Auth is client-side because
 * the JWT lives in localStorage (Bearer flow) — server components can't see it,
 * so a true SSR gate would require restructuring auth around cookies.
 *
 * Backend already enforces @Roles('admin') on the underlying endpoints; this
 * gate stops non-admins from seeing the admin UI shell + empty-state flashes.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    if (user.role !== 'admin') {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="p-6 text-muted text-sm">Loading…</div>;
  }
  if (!user || user.role !== 'admin') {
    return null;
  }
  return <>{children}</>;
}
