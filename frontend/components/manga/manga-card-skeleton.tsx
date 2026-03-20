import { PixelSkeleton } from '@pxlkit/ui-kit';

export function MangaCardSkeleton() {
  return (
    <div className="space-y-2">
      <PixelSkeleton className="aspect-[2/3] w-full rounded-[4px]" />
      <PixelSkeleton className="h-4 w-3/4 rounded" />
      <PixelSkeleton className="h-3 w-1/3 rounded" />
    </div>
  );
}
