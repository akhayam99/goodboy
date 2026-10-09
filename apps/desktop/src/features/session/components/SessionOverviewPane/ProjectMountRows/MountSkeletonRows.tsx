import { Skeleton, cn } from '@goodboy/ui';
import { MountTrackGrid } from './MountTrackGrid';
import { MOUNT_ROW_HEIGHT } from './mountGrid';

const ROW_BRANCH_WIDTHS = ['w-48', 'w-36'] as const;

export const MountSkeletonRows = () => (
  <div role="status" aria-label="Loading projects" data-testid="mount-skeleton" className="min-w-0">
    <MountTrackGrid className="gap-y-0.5">
      <div className="col-span-full flex min-h-8 items-center gap-2 px-2">
        <Skeleton className="size-3.5 rounded-sm" />
        <Skeleton className="h-3.5 w-28" />
      </div>
      <ul className="col-span-full grid grid-cols-subgrid gap-y-0.5 pl-4">
        {ROW_BRANCH_WIDTHS.map((width) => (
          <li
            key={width}
            data-testid="mount-skeleton-row"
            data-row-height={MOUNT_ROW_HEIGHT}
            style={{ height: MOUNT_ROW_HEIGHT }}
            className="col-span-full grid grid-cols-subgrid items-center gap-x-3 px-1"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Skeleton className="size-3.5 rounded-sm" />
              <Skeleton className={cn('h-6 max-w-full rounded-md', width)} />
            </div>
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
            <div className="flex justify-end">
              <Skeleton className="h-3.5 w-12" />
            </div>
          </li>
        ))}
      </ul>
    </MountTrackGrid>
  </div>
);
