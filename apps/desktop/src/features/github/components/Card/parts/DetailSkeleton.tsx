export const DetailSkeleton = () => {
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-label="loading pr data">
      <div className="h-2.5 w-3/4 motion-safe:animate-pulse rounded bg-muted [animation-delay:0ms]" />
      <div className="h-2.5 w-1/2 motion-safe:animate-pulse rounded bg-muted [animation-delay:120ms]" />
      <div className="h-2.5 w-2/3 motion-safe:animate-pulse rounded bg-muted [animation-delay:240ms]" />
    </div>
  );
};
