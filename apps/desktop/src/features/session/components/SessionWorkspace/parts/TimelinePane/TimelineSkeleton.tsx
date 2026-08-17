import { Skeleton } from '@goodboy/ui';

export const TimelineSkeleton = () => (
  <div className="flex flex-col gap-2 p-4" aria-label="Loading timeline">
    {Array.from({ length: 6 }, (_, index) => (
      <div key={index} className="flex h-9 items-center gap-2">
        <Skeleton className="size-4" />
        <Skeleton className="size-4" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-20" />
      </div>
    ))}
  </div>
);
