import { Skeleton } from '@goodboy/ui';

export const ArtifactSkeleton = () => (
  <div
    role="status"
    aria-label="Loading"
    data-testid="artifact-skeleton"
    className="flex min-w-0 flex-col gap-3"
  >
    <Skeleton className="aspect-video w-full" />
    <Skeleton className="h-3 w-2/3" />
  </div>
);
