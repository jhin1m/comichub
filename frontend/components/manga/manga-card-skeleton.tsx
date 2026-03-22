import { Skeleton } from '@/components/ui/skeleton';

export function MangaCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-[2/3] w-full rounded-[4px]" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-3 w-1/3 rounded" />
    </div>
  );
}
