'use client';

import Link from 'next/link';
import { UserPlus } from '@phosphor-icons/react';
import { useAuth } from '@/contexts/auth.context';

export function CommunityCTACard() {
  const { user } = useAuth();

  // Don't show for logged-in users
  if (user) return null;

  return (
    <div className="mt-6 p-5 rounded-lg bg-gradient-to-br from-surface to-accent/[0.04] border border-default text-center">
      <h3 className="font-rajdhani font-bold text-lg text-primary mb-1.5">
        Join ComicHub
      </h3>
      <p className="text-xs text-secondary leading-relaxed mb-4">
        Track your reading, bookmark favorites, and connect with comic fans.
      </p>
      <Link
        href="/register"
        className="w-full h-10 rounded-md bg-accent text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors"
      >
        <UserPlus size={14} />
        Create Free Account
      </Link>
      <Link
        href="/login"
        className="block mt-2 text-xs text-muted hover:text-accent transition-colors"
      >
        Already have an account? Log in
      </Link>
    </div>
  );
}
