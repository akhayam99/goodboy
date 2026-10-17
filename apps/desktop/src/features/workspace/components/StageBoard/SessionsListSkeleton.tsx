import { cn, PANE_RHYTHM, Skeleton } from '@goodboy/ui';

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

export const SessionsListSkeleton = () => (
  <div
    role="status"
    aria-label="Loading sessions"
    data-skeleton="sessions-list"
    className={cn('flex w-full flex-col', PANE_RHYTHM.sessionList.rowGap)}
  >
    {ROWS.map((row) => (
      <div key={row} className="flex min-h-8 min-w-0 items-center gap-3 px-2">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-1/2 rounded-sm" />
        <span className="flex-1" />
        <Skeleton className="h-3 w-24 rounded-sm" />
        <Skeleton className="h-3 w-12 rounded-sm" />
      </div>
    ))}
  </div>
);
