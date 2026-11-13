import { Skeleton } from '@goodboy/ui';

const ROWS = [0, 1, 2, 3, 4, 5];

export const StudioSkeleton = () => (
  <div
    role="status"
    aria-label="Loading"
    data-testid="studio-skeleton"
    className="flex min-h-0 flex-1 flex-col gap-4 p-6"
  >
    <div className="flex h-8 items-center">
      <Skeleton className="h-4 w-40" />
    </div>
    <div className="flex flex-col gap-1">
      {ROWS.map((row) => (
        <div key={row} className="flex min-h-8 items-center gap-3 px-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      ))}
    </div>
  </div>
);
