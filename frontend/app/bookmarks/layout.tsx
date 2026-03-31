import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';

export const metadata: Metadata = buildMeta({
  title: 'Bookmarks',
  description: 'Your bookmarked manga on ComicHub.',
  path: '/bookmarks',
  noIndex: true,
});

export default function BookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
