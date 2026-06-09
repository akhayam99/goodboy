import { cn } from '../cn';

type SkeletonProps = {
  className?: string;
};

export const Skeleton = ({ className }: SkeletonProps) => {
  return (
    <div className={cn('motion-safe:animate-pulse rounded bg-muted', className)} aria-hidden />
  );
};
