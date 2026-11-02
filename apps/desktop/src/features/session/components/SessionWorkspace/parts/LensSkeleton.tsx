import { PageSkeleton, Skeleton, SkeletonText } from '@goodboy/ui';
import type { FramePage } from '@goodboy/ui';

const LENS_ROWS = [0, 1, 2];

type Props = {
  readonly page: FramePage;
  readonly label: string;
};

export const LensSkeleton = ({ page, label }: Props) => (
  <PageSkeleton page={page} label={label}>
    <SkeletonText lines={2} />
    <div className="flex flex-col gap-2">
      {LENS_ROWS.map((row) => (
        <Skeleton key={row} className="h-9 w-full rounded-md" />
      ))}
    </div>
  </PageSkeleton>
);
