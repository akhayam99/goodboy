import { Skeleton } from '@goodboy/ui';

export const InboxSkeleton = () => {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading notifications">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2.5 rounded-lg border border-border-soft p-4">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
      ))}
    </div>
  );
};
