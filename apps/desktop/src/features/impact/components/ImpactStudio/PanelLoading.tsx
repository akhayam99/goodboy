import { Skeleton, SkeletonText } from '@goodboy/ui';

export const PanelLoading = () => (
  <div className="flex flex-col gap-4" role="status" aria-label="Loading impact metrics">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-20" />
      ))}
    </div>
    <SkeletonText lines={4} />
  </div>
);
