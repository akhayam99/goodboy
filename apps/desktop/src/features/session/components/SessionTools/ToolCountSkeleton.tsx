import { Skeleton } from '@goodboy/ui';

export const ToolCountSkeleton = () => (
  <span
    role="status"
    aria-label="Loading"
    data-testid="tool-count-skeleton"
    className="pointer-events-none absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center"
  >
    <Skeleton className="h-3.5 w-3.5 rounded-full" />
  </span>
);
