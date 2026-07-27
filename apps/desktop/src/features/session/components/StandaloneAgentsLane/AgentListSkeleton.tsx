export const AgentListSkeleton = () => (
  <ul role="status" aria-label="loading agents" className="flex flex-col gap-1">
    {[0, 1].map((index) => (
      <li key={index} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
        <span className="h-3 w-3 motion-safe:animate-pulse rounded-full bg-muted" />
        <span className="h-3 flex-1 motion-safe:animate-pulse rounded bg-muted" />
      </li>
    ))}
  </ul>
);
