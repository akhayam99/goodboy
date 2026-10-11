import { Band, Skeleton, cn } from '@goodboy/ui';
import { MountTrackGrid } from './MountTrackGrid';
import { MOUNT_CHILD_PAD, MOUNT_ROW_HEIGHT, MOUNT_ROW_PAD } from './mountGrid';

const ROW_BRANCH_WIDTHS = ['w-48', 'w-36'] as const;

export const MountSkeletonRows = () => (
  <div role="status" aria-label="Loading projects" data-testid="mount-skeleton" className="min-w-0">
    <Band>
      <MountTrackGrid className="gap-y-0.5">
        <div
          style={{
            height: MOUNT_ROW_HEIGHT,
            paddingLeft: MOUNT_ROW_PAD,
            paddingRight: MOUNT_ROW_PAD,
          }}
          className="col-span-full flex items-center gap-2"
        >
          <Skeleton className="size-3.5 rounded-sm" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <ul className="col-span-full grid grid-cols-subgrid gap-y-0.5">
          {ROW_BRANCH_WIDTHS.map((width) => (
            <li
              key={width}
              data-testid="mount-skeleton-row"
              data-row-height={MOUNT_ROW_HEIGHT}
              style={{
                height: MOUNT_ROW_HEIGHT,
                paddingLeft: MOUNT_CHILD_PAD,
                paddingRight: MOUNT_ROW_PAD,
              }}
              className="col-span-full grid grid-cols-subgrid items-center gap-x-3"
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
    </Band>
  </div>
);
