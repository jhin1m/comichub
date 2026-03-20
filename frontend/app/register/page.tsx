import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';
import { OAuthButton } from '@/components/auth/oauth-button';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0f0f0f]">
      <div className="w-full max-w-[420px] bg-surface border border-[#2a2a2a] rounded-lg p-8 space-y-6">
        <div className="border-t-4 border-accent -mx-8 -mt-8 mb-6 rounded-t-lg" />
        <h1 className="font-rajdhani font-bold text-3xl text-[#f5f5f5]">Create Account</h1>
        <RegisterForm />
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-[#2a2a2a]" />
          <span className="text-[#5a5a5a] text-xs">OR</span>
          <div className="flex-1 h-px bg-[#2a2a2a]" />
        </div>
        <OAuthButton />
        <p className="text-center text-sm text-[#a0a0a0]">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
