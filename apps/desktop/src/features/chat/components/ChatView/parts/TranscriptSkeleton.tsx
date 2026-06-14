import { Skeleton } from '@goodboy/ui';

export const TranscriptSkeleton = () => {
  return (
    <div
      role="status"
      aria-label="loading transcript"
      className="mx-auto flex w-full max-w-[880px] flex-col gap-6"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
};
