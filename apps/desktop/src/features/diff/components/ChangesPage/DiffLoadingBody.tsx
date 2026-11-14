import { Skeleton } from '@goodboy/ui';

export const DiffLoadingBody = () => (
  <div role="status" aria-label="Loading the diff" className="flex flex-col gap-3 pl-4 pr-6">
    {[0, 1].map((index) => (
      <div key={index} className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-3 w-3/4 rounded-sm" />
        <Skeleton className="h-3 w-1/2 rounded-sm" />
      </div>
    ))}
  </div>
);
