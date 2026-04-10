import type { Metadata } from 'next';
import { buildMeta, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = buildMeta({
  title: 'Content Preferences',
  description: `Customize your content preferences on ${SITE_NAME}.`,
  path: '/settings/preferences',
  noIndex: true,
});

export default function PreferencesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
