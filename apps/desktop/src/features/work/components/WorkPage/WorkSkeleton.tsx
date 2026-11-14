import { Skeleton } from '@goodboy/ui';

const ROWS = [0, 1, 2, 3];

export const WorkSkeleton = () => (
  <div role="status" aria-label="Reading Leads" className="flex flex-col gap-2">
    {ROWS.map((row) => (
      <Skeleton key={row} className="h-14 w-full" />
    ))}
  </div>
);
