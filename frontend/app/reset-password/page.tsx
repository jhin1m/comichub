'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-secondary">Invalid or missing reset link.</p>
        <Link href="/forgot-password" className="text-accent hover:underline text-sm">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base">
      <div className="w-full max-w-105 bg-surface border border-default rounded-lg p-8 space-y-6">
        <div className="border-t-4 border-accent -mx-8 -mt-8 mb-6 rounded-t-lg" />
        <h1 className="font-rajdhani font-bold text-3xl text-primary">Reset Password</h1>
        <Suspense fallback={<p className="text-secondary text-center">Loading...</p>}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}
