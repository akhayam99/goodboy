import { Skeleton } from '@goodboy/ui';

export const AgentListSkeleton = () => (
  <ul role="status" aria-label="Loading agents" className="flex flex-col gap-1">
    {[0, 1].map((index) => (
      <li key={index} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 flex-1" />
      </li>
    ))}
  </ul>
);
