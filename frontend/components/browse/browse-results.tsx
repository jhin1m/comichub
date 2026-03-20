import { MangaGrid } from '@/components/manga/manga-grid';
import { PixelPagination } from '@pxlkit/ui-kit';
import type { PaginatedResult, MangaListItem } from '@/types/manga.types';

interface BrowseResultsProps {
  result: PaginatedResult<MangaListItem> | null;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function BrowseResults({
  result,
  isLoading,
  currentPage,
  onPageChange,
}: BrowseResultsProps) {
  const totalPages = result ? Math.ceil(result.total / result.limit) : 0;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#a0a0a0]">
          {isLoading ? 'Loading...' : result ? `${result.total} results` : '0 results'}
        </p>
      </div>

      <MangaGrid
        items={result?.data ?? []}
        isLoading={isLoading}
        skeletonCount={24}
      />

      {!isLoading && totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <PixelPagination
            page={currentPage}
            total={totalPages}
            onChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
