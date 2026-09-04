import { Skeleton, cn } from '@goodboy/ui';
import { TIMELINE_GUTTER } from './timelineLayout';

const ROW_KEYS = ['first', 'second', 'third', 'fourth'] as const;

export const TimelineSkeleton = () => (
  <div className="flex flex-col" role="status" aria-label="Loading the timeline">
    {ROW_KEYS.map((key) => (
      <div key={key} className="flex min-w-0 items-center gap-2 py-1.5">
        <span className={cn('shrink-0 pr-2', TIMELINE_GUTTER)}>
          <Skeleton className="h-2.5 w-10" />
        </span>
        <Skeleton className="size-2.5 shrink-0 rounded-full" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 pl-2 pr-1.5">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-2.5 w-3/5" />
        </span>
      </div>
    ))}
  </div>
);
