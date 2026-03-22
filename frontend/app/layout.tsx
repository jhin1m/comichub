import type { Metadata } from 'next';
import { Rajdhani, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import Providers from './providers';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';

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
  title: 'ComicHub — Read Manga Online',
  description: 'Read manga, manhwa, and manhua online for free.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
          <Toaster position="top-right" theme="dark" richColors />
        </Providers>
      </body>
    </html>
  );
}
