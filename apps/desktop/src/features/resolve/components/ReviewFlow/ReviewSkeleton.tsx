import { Skeleton } from '@goodboy/ui';

const SKELETON_ROWS = [0, 1, 2];

export const ReviewSkeleton = () => (
  <div className="flex w-full flex-col gap-3">
    {SKELETON_ROWS.map((key) => (
      <div key={key} className="flex flex-col gap-2 px-3 py-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-4 w-full" />
      </div>
    ))}
  </div>
);
