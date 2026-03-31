import type { Metadata } from 'next';
import { buildMeta } from '@/lib/seo';

export const metadata: Metadata = buildMeta({
  title: 'Content Preferences',
  description: 'Customize your content preferences on ComicHub.',
  path: '/settings/preferences',
  noIndex: true,
});

export default function PreferencesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
