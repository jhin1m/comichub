import { MangaGrid } from '@/components/manga/manga-grid';
import { Pagination } from '@/components/ui/pagination';
import type { PaginatedResult, MangaListItem } from '@/types/manga.types';

interface BrowseResultsProps {
  result: PaginatedResult<MangaListItem> | null;
  isLoading: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  // viewMode is accepted for future list view support
  viewMode?: 'grid' | 'list';
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
      <MangaGrid
        items={result?.data ?? []}
        isLoading={isLoading}
        skeletonCount={24}
      />

      {!isLoading && totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
