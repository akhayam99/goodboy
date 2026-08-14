import { Skeleton, SkeletonText, cn, tintClasses } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';

const accent = tintClasses('neutral');

export const TranscriptSkeleton = () => {
  return (
    <div
      role="status"
      aria-label="Loading transcript"
      className={cn('flex flex-col gap-6', PANE_RHYTHM.column, PANE_RHYTHM.measure.chat)}
    >
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2.5">
          <Skeleton className="ml-auto h-9 w-2/5 rounded-md" />
          <Skeleton className="h-5 w-32 rounded-md" />
          <div className={`rounded-md px-3 py-2 ${accent.bgSoft}`}>
            <SkeletonText lines={3} />
          </div>
        </div>
      ))}
    </div>
  );
};
