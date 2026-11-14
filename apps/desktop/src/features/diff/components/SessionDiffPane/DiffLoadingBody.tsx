import { PageColumn, Skeleton } from '@goodboy/ui';

export const DiffLoadingBody = () => (
  <PageColumn className="flex flex-col gap-3">
    {[0, 1].map((index) => (
      <div key={index} className="flex flex-col gap-2">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-3 w-3/4 rounded-sm" />
        <Skeleton className="h-3 w-1/2 rounded-sm" />
      </div>
    ))}
  </PageColumn>
);
