import type { Metadata } from 'next';
import { Rajdhani, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import Providers from './providers';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import { BackToTop } from '@/components/ui/back-to-top';
import { JsonLd, buildWebSiteJsonLd, buildOrganizationJsonLd, SITE_URL, SITE_NAME, SITE_LOGO } from '@/lib/seo';

const rajdhani = Rajdhani({
  variable: '--font-rajdhani',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: `%s - ${SITE_NAME}`,
    default: `${SITE_NAME} — Read Manga Online`,
  },
  description: `Read manga, manhwa, and manhua online for free on ${SITE_NAME}.`,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
  },
  ...(SITE_LOGO && { icons: { icon: [SITE_LOGO, '/favicon.ico'] } }),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">
        <JsonLd data={buildWebSiteJsonLd()} />
        <JsonLd data={buildOrganizationJsonLd()} />
        <Providers>
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
          <BackToTop className="fixed bottom-6 right-6 z-40" />
          <Toaster position="top-right" theme="dark" richColors />
        </Providers>
      </body>
    </html>
  );
}
