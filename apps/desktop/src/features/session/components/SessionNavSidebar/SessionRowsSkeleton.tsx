import { cn, PANE_RHYTHM, Skeleton } from '@goodboy/ui';

const ROW_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4', 'w-1/2'];

export const SessionRowsSkeleton = () => (
  <div
    role="status"
    aria-label="Loading sessions"
    data-session-rows-skeleton=""
    className={cn('flex flex-col', PANE_RHYTHM.sessionList.rowGap, PANE_RHYTHM.sessionList.pad)}
  >
    {ROW_WIDTHS.map((width) => (
      <div
        key={width}
        className={cn(
          'flex h-7 items-center justify-between gap-2',
          PANE_RHYTHM.sessionList.rowInset,
        )}
      >
        <Skeleton className={cn('h-3 rounded-sm', width)} />
        <Skeleton className="size-2 shrink-0 rounded-full" />
      </div>
    ))}
  </div>
);
