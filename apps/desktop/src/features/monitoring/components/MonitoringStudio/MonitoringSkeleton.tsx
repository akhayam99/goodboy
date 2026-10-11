import { Skeleton } from '@goodboy/ui';

const ROWS = [0, 1, 2, 3, 4];

export const MonitoringSkeleton = () => (
  <div role="status" aria-label="Reading ports" className="flex flex-col gap-2">
    {ROWS.map((row) => (
      <Skeleton key={row} className="h-8 w-full" />
    ))}
  </div>
);
