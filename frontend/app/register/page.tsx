import Link from 'next/link';
import { buildMeta, SITE_NAME } from '@/lib/seo';
import { RegisterForm } from '@/components/auth/register-form';
import { OAuthButton } from '@/components/auth/oauth-button';

export const metadata = buildMeta({
  title: 'Register',
  description: `Create a ${SITE_NAME} account to bookmark manga and track reading progress.`,
  path: '/register',
  noIndex: true,
});

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base">
      <div className="w-full max-w-105 bg-surface border border-default rounded-lg p-8 space-y-6">
        <div className="border-t-4 border-accent -mx-8 -mt-8 mb-6 rounded-t-lg" />
        <h1 className="font-rajdhani font-bold text-3xl text-primary">Create Account</h1>
        <RegisterForm />
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-default" />
          <span className="text-muted text-xs">OR</span>
          <div className="flex-1 h-px bg-default" />
        </div>
        <OAuthButton />
        <p className="text-center text-sm text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
