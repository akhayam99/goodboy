import type { CSSProperties } from 'react';
import { cn } from '../cn';

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export const Skeleton = ({ className, style }: SkeletonProps) => {
  return (
    <div
      className={cn('motion-safe:animate-pulse rounded bg-muted', className)}
      style={style}
      aria-hidden
    />
  );
};

type SkeletonTextProps = {
  className?: string;
  lines?: number;
};

export const SkeletonText = ({ className, lines = 3 }: SkeletonTextProps) => {
  return (
    <div className={cn('flex flex-col gap-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3 rounded', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
};
