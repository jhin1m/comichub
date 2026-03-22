import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse bg-elevated rounded', className)}
      {...rest}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
