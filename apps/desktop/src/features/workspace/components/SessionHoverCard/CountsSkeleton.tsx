import { Skeleton } from '@goodboy/ui';

export const CountsSkeleton = () => (
  <span role="status" aria-label="Loading" data-testid="counts-skeleton" className="flex gap-2">
    <Skeleton className="h-3 w-12" />
    <Skeleton className="h-3 w-8" />
  </span>
);
