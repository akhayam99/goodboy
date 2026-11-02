import { PageSkeleton, Skeleton, SkeletonRow, SkeletonText } from '@goodboy/ui';

const FACT_CHIPS = ['w-24', 'w-32', 'w-28'];
const STEP_ROWS = [0, 1, 2];

export const RunPageSkeleton = () => (
  <PageSkeleton page="run" label="Loading run">
    <div data-run-skeleton="" className="flex min-w-0 flex-col gap-6">
      <SkeletonText lines={2} />
      <div className="flex flex-wrap items-center gap-2">
        {FACT_CHIPS.map((width) => (
          <Skeleton key={width} className={`h-6 ${width} rounded-md`} />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {STEP_ROWS.map((row) => (
          <SkeletonRow key={row} label="Loading steps" />
        ))}
      </div>
    </div>
  </PageSkeleton>
);
