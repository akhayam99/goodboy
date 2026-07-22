import { ScrollFade, Skeleton, SkeletonText } from '@goodboy/ui';

const ACTIVITY_ROWS = [0, 1];
const LINKED_WORK_ROWS = [0, 1];

export const SessionOverviewSkeleton = () => {
  return (
    <ScrollFade className="h-full" viewportClassName="px-8 py-7" fadeSize={24}>
      <div
        className="mx-auto flex max-w-3xl flex-col gap-6"
        role="status"
        aria-label="Loading session overview"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-full" />
          </div>
          <Skeleton className="h-7 w-3/5" />
          <SkeletonText className="max-w-xl" lines={2} />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-12 rounded-full" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16 rounded-full" />
          <div className="flex flex-col gap-2">
            {ACTIVITY_ROWS.map((row) => (
              <Skeleton key={row} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-md" />
          </div>
          <div className="flex flex-col gap-2">
            {LINKED_WORK_ROWS.map((row) => (
              <Skeleton key={row} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </ScrollFade>
  );
};
