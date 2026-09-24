import { Skeleton } from '@goodboy/ui';

export const NotificationsSkeleton = () => {
  return (
    <div className="flex flex-col gap-0.5" role="status" aria-label="Loading notifications">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[1rem_minmax(0,1fr)_4rem] items-start gap-x-2.5 px-2.5 py-2"
        >
          <Skeleton className="size-3.5 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-2/3 rounded-sm" />
            <Skeleton className="h-3 w-4/5 rounded-sm" />
          </div>
          <Skeleton className="h-2.5 w-10 justify-self-end rounded-sm" />
        </div>
      ))}
    </div>
  );
};
