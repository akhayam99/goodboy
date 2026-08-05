import { Skeleton } from '@goodboy/ui';

export const NoteListSkeleton = () => (
  <div role="status" aria-label="Loading comments" className="flex flex-col gap-4">
    {[0, 1, 2].map((row) => (
      <div key={row} className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
        <Skeleton className="h-3 w-28 rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
      </div>
    ))}
  </div>
);
