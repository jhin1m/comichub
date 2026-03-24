import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  if (current <= 3) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 2) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];

  return [1, '...', current - 1, current, current + 1, '...', total];
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageRange(currentPage, totalPages);
  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages;

  const btnBase = 'inline-flex items-center justify-center h-9 min-w-[36px] px-2 rounded-md text-sm font-semibold transition-colors';

  return (
    <nav aria-label="Pagination" className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isPrevDisabled}
        aria-label="Previous page"
        className={cn(btnBase, 'bg-surface text-secondary hover:bg-hover', isPrevDisabled && 'opacity-40 cursor-not-allowed pointer-events-none')}
      >
        <CaretLeft size={18} />
      </button>

      {pages.map((page, i) =>
        page === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-muted select-none">
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className={cn(
              btnBase,
              page === currentPage
                ? 'bg-accent text-white'
                : 'bg-surface text-secondary hover:bg-hover',
            )}
          >
            {page}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isNextDisabled}
        aria-label="Next page"
        className={cn(btnBase, 'bg-surface text-secondary hover:bg-hover', isNextDisabled && 'opacity-40 cursor-not-allowed pointer-events-none')}
      >
        <CaretRight size={18} />
      </button>
    </nav>
  );
}

export { Pagination };
export type { PaginationProps };
