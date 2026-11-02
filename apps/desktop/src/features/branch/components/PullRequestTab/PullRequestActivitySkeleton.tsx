import { Skeleton } from '@goodboy/ui';

const ACTIVITY_SKELETON_ROWS = [0, 1, 2, 3];

type Props = {
  readonly label: string;
};

export const PullRequestActivitySkeleton = ({ label }: Props) => (
  <div role="status" aria-label={label} className="flex min-w-0 flex-col gap-4">
    {ACTIVITY_SKELETON_ROWS.map((row) => (
      <div key={row} className="flex min-w-0 items-start gap-3">
        <span className="flex h-4 shrink-0 items-center">
          <Skeleton className="size-2.5 rounded-full" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/4 rounded-sm" />
        </div>
      </div>
    ))}
  </div>
);
