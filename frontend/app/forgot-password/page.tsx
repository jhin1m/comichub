import Link from 'next/link';
import { buildMeta, SITE_NAME } from '@/lib/seo';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata = buildMeta({
  title: 'Forgot Password',
  description: `Reset your ${SITE_NAME} account password.`,
  path: '/forgot-password',
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base">
      <div className="w-full max-w-105 bg-surface border border-default rounded-lg p-8 space-y-6">
        <div className="border-t-4 border-accent -mx-8 -mt-8 mb-6 rounded-t-lg" />
        <h1 className="font-rajdhani font-bold text-3xl text-primary">Forgot Password</h1>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
