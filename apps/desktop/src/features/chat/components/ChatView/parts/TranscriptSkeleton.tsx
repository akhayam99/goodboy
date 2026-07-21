import { Skeleton, SkeletonText } from '@goodboy/ui';
import { MARKER_ACCENT } from '../../marker-accents';

const accent = MARKER_ACCENT.neutral;

export const TranscriptSkeleton = () => {
  return (
    <div
      role="status"
      aria-label="loading transcript"
      className="mx-auto flex w-full max-w-[880px] flex-col gap-6"
    >
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2.5">
          {/* user turn: short bubble pinned right */}
          <Skeleton className="ml-auto h-9 w-2/5 rounded-md" />
          {/* operations chip line */}
          <Skeleton className="h-5 w-32 rounded-md" />
          {/* assistant reply */}
          <div className={`rounded-md px-3 py-2 ${accent.bgSoft}`}>
            <SkeletonText lines={3} />
          </div>
        </div>
      ))}
    </div>
  );
};
