import { ScrollFade, Skeleton, SkeletonText, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';

const PROJECT_ROWS = [0, 1];
const TIMELINE_ROWS = [0, 1, 2];

type Props = {
  readonly isFreshLayout: boolean;
};

export const SessionOverviewSkeleton = ({ isFreshLayout }: Props) => {
  return (
    <ScrollFade className="h-full" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
      <div
        className={cn(PANE_RHYTHM.column, PANE_RHYTHM.stack)}
        role="status"
        aria-label="Loading session overview"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-7 w-3/5" />
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-28 rounded-md" />
                <Skeleton className="h-6 w-14 rounded-md" />
              </div>
            </div>
          </div>
          <SkeletonText lines={2} />
          <div className="flex flex-col gap-1.5">
            {PROJECT_ROWS.map((row) => (
              <Skeleton key={row} className="h-9 w-full rounded-md" />
            ))}
          </div>
        </div>

        {isFreshLayout ? (
          <div className="flex flex-col gap-3 rounded-lg bg-subtle p-4">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-5 w-36" />
            <SkeletonText lines={2} />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-md" />
            </div>
            {TIMELINE_ROWS.map((row) => (
              <div key={row} className="flex items-start gap-3">
                <Skeleton className="mt-1 size-2.5 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-3/4 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollFade>
  );
};
