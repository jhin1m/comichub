export const dynamic = 'force-dynamic';

import { cache } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CaretLeft, CaretRight, Users } from '@phosphor-icons/react/ssr';
import { groupApi } from '@/lib/api/manga.api';
import { buildMeta, SITE_NAME } from '@/lib/seo';
import { Badge } from '@/components/ui/badge';
import PageWrapper from '@/components/layout/page-wrapper';
import { formatRelativeDate, formatCount, statusVariant } from '@/lib/utils';
import type { MangaListItem } from '@/types/manga.types';

const getGroupDetail = cache((slug: string, page: number) => groupApi.detail(slug, page));

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

interface LinkPaginationProps {
  currentPage: number;
  totalPages: number;
  slug: string;
}

function LinkPagination({ currentPage, totalPages, slug }: LinkPaginationProps) {
  if (totalPages <= 1) return null;

  const btnBase =
    'inline-flex items-center justify-center h-9 min-w-[36px] px-2 rounded-md text-sm font-semibold transition-colors';

  function getPages(): (number | '...')[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, 5, '...', totalPages];
    if (currentPage >= totalPages - 2)
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }

  const pages = getPages();
  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages;

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      {isPrevDisabled ? (
        <span className={`${btnBase} bg-surface text-secondary opacity-40 cursor-not-allowed`}>
          <CaretLeft size={18} />
        </span>
      ) : (
        <Link
          href={`/groups/${slug}?page=${currentPage - 1}`}
          aria-label="Previous page"
          className={`${btnBase} bg-surface text-secondary hover:bg-hover`}
        >
          <CaretLeft size={18} />
        </Link>
      )}

      {pages.map((page, i) =>
        page === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-muted select-none">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={`/groups/${slug}?page=${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
            className={`${btnBase} ${
              page === currentPage ? 'bg-accent text-white' : 'bg-surface text-secondary hover:bg-hover'
            }`}
          >
            {page}
          </Link>
        ),
      )}

      {isNextDisabled ? (
        <span className={`${btnBase} bg-surface text-secondary opacity-40 cursor-not-allowed`}>
          <CaretRight size={18} />
        </span>
      ) : (
        <Link
          href={`/groups/${slug}?page=${currentPage + 1}`}
          aria-label="Next page"
          className={`${btnBase} bg-surface text-secondary hover:bg-hover`}
        >
          <CaretRight size={18} />
        </Link>
      )}
    </nav>
  );
}

interface MangaRowProps {
  manga: MangaListItem;
}

function MangaRow({ manga }: MangaRowProps) {
  return (
    <Link
      href={`/manga/${manga.slug}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-default/40 hover:bg-hover transition-colors group"
    >
      {/* Cover thumbnail */}
      <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-surface border border-default">
        {manga.cover ? (
          <Image
            src={manga.cover}
            alt={manga.title}
            fill
            className="object-cover"
            sizes="40px"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-[9px]">No Cover</div>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary truncate group-hover:text-accent transition-colors">
          {manga.title}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {manga.chaptersCount} {manga.chaptersCount === 1 ? 'chapter' : 'chapters'}
        </p>
      </div>

      {/* Status */}
      <div className="hidden sm:block w-24 shrink-0">
        <Badge variant={statusVariant(manga.status)}>{capitalize(manga.status)}</Badge>
      </div>

      {/* Followers */}
      <div className="hidden md:block w-20 shrink-0 text-right text-xs text-muted">
        {formatCount(manga.views)} views
      </div>

      {/* Updated */}
      <div className="w-20 shrink-0 text-right text-xs text-muted">
        {formatRelativeDate(manga.updatedAt)}
      </div>
    </Link>
  );
}

export default async function GroupDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);

  try {
    const { group, manga } = await getGroupDetail(slug, page);
    const totalPages = Math.ceil(manga.total / manga.limit);
    const initials = getInitials(group.name);

    return (
      <>
        {/* ===== GROUP HEADER ===== */}
        <section className="border-b border-default bg-surface/30">
          <PageWrapper className="py-8">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center shrink-0">
                <span className="font-rajdhani font-bold text-xl text-accent">{initials}</span>
              </div>

              {/* Info */}
              <div className="min-w-0">
                <Badge variant="accent" className="mb-2">
                  <Users size={10} className="mr-1" />
                  Scanlation Group
                </Badge>
                <h1 className="font-rajdhani font-bold text-3xl text-primary leading-tight">
                  {group.name}
                </h1>
                <p className="text-sm text-muted mt-1">
                  {group.releaseCount.toLocaleString()} releases in{' '}
                  {group.titleCount.toLocaleString()} titles
                </p>
              </div>
            </div>
          </PageWrapper>
        </section>

        {/* ===== MAIN CONTENT ===== */}
        <PageWrapper className="py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
            {/* Manga table */}
            <div>
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-default bg-surface/50 rounded-t text-xs font-semibold uppercase tracking-wider text-muted">
                <div className="w-10 shrink-0" />
                <div className="flex-1">Title</div>
                <div className="hidden sm:block w-24 shrink-0">Status</div>
                <div className="hidden md:block w-20 shrink-0 text-right">Views</div>
                <div className="w-20 shrink-0 text-right">Updated</div>
              </div>

              {/* Rows */}
              <div className="border border-default border-t-0 rounded-b overflow-hidden">
                {manga.data.length === 0 ? (
                  <p className="px-4 py-8 text-center text-muted text-sm">No manga found.</p>
                ) : (
                  manga.data.map((m) => <MangaRow key={m.id} manga={m} />)
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <LinkPagination currentPage={page} totalPages={totalPages} slug={slug} />
                </div>
              )}
            </div>

            {/* Sidebar — Description */}
            <aside>
              <div className="bg-surface border border-default rounded p-4">
                <h2 className="font-rajdhani font-bold text-primary uppercase tracking-wider mb-3">
                  Description
                </h2>
                <p className="text-sm text-muted">There is no description.</p>
              </div>
            </aside>
          </div>
        </PageWrapper>
      </>
    );
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.status === 404) {
      notFound();
    }
    throw err;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
  try {
    const { group } = await getGroupDetail(slug, page);
    return buildMeta({
      title: `${group.name} - Scanlation Group`,
      description: `${group.releaseCount} releases in ${group.titleCount} titles by ${group.name} on ${SITE_NAME}.`,
      path: `/groups/${slug}`,
    });
  } catch {
    return { title: 'Group Not Found' };
  }
}
