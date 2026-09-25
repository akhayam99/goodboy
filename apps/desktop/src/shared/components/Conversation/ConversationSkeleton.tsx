import { Skeleton } from '@goodboy/ui';

export const ConversationSkeleton = () => (
  <div role="status" aria-label="Loading the conversation" className="flex flex-col gap-3">
    {[0, 1, 2].map((row) => (
      <div key={row} className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 px-1.5">
        <Skeleton className="h-6 w-6 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-28 rounded-sm" />
          <Skeleton className="h-3 w-full rounded-sm" />
        </div>
      </div>
    ))}
  </div>
);
