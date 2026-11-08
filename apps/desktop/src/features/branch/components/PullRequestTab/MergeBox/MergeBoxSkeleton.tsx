import { Skeleton } from '@goodboy/ui';

export const MergeBoxSkeleton = () => (
  <>
    <span className="sr-only">Reading merge status</span>
    <div className="flex min-w-0 items-center gap-3 px-3 py-2">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-40 rounded-sm" />
        <Skeleton className="h-3 w-64 rounded-sm" />
      </span>
    </div>
    <div className="flex min-h-9 min-w-0 items-center gap-3 px-3">
      <Skeleton className="size-4 shrink-0 rounded-full" />
      <Skeleton className="h-3 w-1/2 rounded-sm" />
    </div>
  </>
);
