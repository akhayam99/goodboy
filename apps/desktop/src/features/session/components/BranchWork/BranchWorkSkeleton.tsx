import { PageColumn, Skeleton } from '@goodboy/ui';

const ROWS = [0, 1, 2] as const;

export const BranchWorkSkeleton = () => (
  <PageColumn width="column" className="flex min-w-0 flex-col pb-5">
    <div role="status" aria-label="Loading work" className="flex min-w-0 flex-col gap-2">
      <Skeleton className="h-3 w-24 rounded-sm" />
      {ROWS.map((index) => (
        <div key={index} className="flex h-8 items-center gap-3">
          <Skeleton className="h-3 w-1/2 rounded-sm" />
          <Skeleton className="h-3 w-1/6 rounded-sm" />
        </div>
      ))}
    </div>
  </PageColumn>
);
