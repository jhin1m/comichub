import type { Metadata } from 'next';
import { buildMeta, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = buildMeta({
  title: 'Bookmarks',
  description: `Your bookmarked manga on ${SITE_NAME}.`,
  path: '/bookmarks',
  noIndex: true,
});

export default function BookmarksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
