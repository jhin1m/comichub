import Link from 'next/link';
import { buildMeta } from '@/lib/seo';
import { LoginForm } from '@/components/auth/login-form';
import { OAuthButton } from '@/components/auth/oauth-button';

export const metadata = buildMeta({
  title: 'Login',
  description: 'Sign in to your ComicHub account.',
  path: '/login',
  noIndex: true,
});

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base">
      <div className="w-full max-w-[420px] bg-surface border border-default rounded-lg p-8 space-y-6">
        <div className="border-t-4 border-accent -mx-8 -mt-8 mb-6 rounded-t-lg" />
        <h1 className="font-rajdhani font-bold text-3xl text-primary">Welcome Back</h1>
        <LoginForm />
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-default" />
          <span className="text-muted text-xs">OR</span>
          <div className="flex-1 h-px bg-default" />
        </div>
        <OAuthButton />
        <p className="text-center text-sm text-secondary">
          No account?{' '}
          <Link href="/register" className="text-accent hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
