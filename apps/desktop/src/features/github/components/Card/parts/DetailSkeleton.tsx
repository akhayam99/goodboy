import { Skeleton } from '@goodboy/ui';

export const DetailSkeleton = () => {
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-label="Loading pr data">
      <Skeleton className="h-2.5 w-3/4" />
      <Skeleton className="h-2.5 w-1/2" />
      <Skeleton className="h-2.5 w-2/3" />
    </div>
  );
};
