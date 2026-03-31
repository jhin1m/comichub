import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';

export const metadata: Metadata = buildMeta({
  title: 'Profile',
  description: 'Your ComicHub profile and reading history.',
  path: '/profile',
  noIndex: true,
});

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
