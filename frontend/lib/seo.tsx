import type { Metadata } from 'next';
import { getMangaUrl } from '@/lib/utils/manga-url';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://comichub.app';
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'ComicHub';
const SITE_LOGO = process.env.NEXT_PUBLIC_SITE_LOGO || '';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

interface BuildMetaOptions {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  noIndex?: boolean;
  /** Use absolute title (skip root template) */
  absoluteTitle?: boolean;
}

/** Build complete Metadata object with OG, Twitter, canonical */
export function buildMeta(options: BuildMetaOptions): Metadata {
  const { title, description, path, image, noIndex, absoluteTitle } = options;
  const url = `${SITE_URL}${path}`;
  const ogImage = image || DEFAULT_OG_IMAGE;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    ...(noIndex && { robots: { index: false, follow: false } }),
  };
}

/** JSON-LD script component for embedding structured data */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // Escape angle brackets to prevent XSS via </script> injection in user data
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

/** WebSite + SearchAction schema for root layout */
export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/browse?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Organization schema for root layout */
export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: SITE_LOGO ? `${SITE_URL}${SITE_LOGO}` : `${SITE_URL}/logo.png`,
  };
}

/** CreativeWork schema for manga detail page */
export function buildMangaJsonLd(manga: {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  cover: string | null;
  authors: { name: string }[];
  genres: { name: string }[];
  averageRating: string;
  totalRatings: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: manga.title,
    url: `${SITE_URL}${getMangaUrl(manga)}`,
    description: manga.description ?? undefined,
    image: manga.cover ?? undefined,
    author: manga.authors.map((a) => ({ '@type': 'Person', name: a.name })),
    genre: manga.genres.map((g) => g.name),
    ...(manga.totalRatings > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: manga.averageRating,
        ratingCount: manga.totalRatings,
        bestRating: '10',
        worstRating: '1',
      },
    }),
  };
}

/** BreadcrumbList schema */
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export { SITE_URL, SITE_NAME, SITE_LOGO };
