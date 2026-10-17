import { FRAME_BAND_PX, PageSkeleton, Skeleton, type FramePage } from '@goodboy/ui';
import type { StudioSkeletonSpec } from './studioMeta';
import { STUDIO_SKELETON_BODIES } from './studioSkeletonBodies';

const RAIL_ITEMS = [0, 1, 2, 3, 4];

type Props = {
  readonly skeleton: StudioSkeletonSpec;
  readonly page: FramePage | null;
  readonly title: string;
  readonly railWidthPx: number;
  readonly isBandInDetail?: boolean;
};

export const StudioSkeleton = ({
  skeleton,
  page,
  title,
  railWidthPx,
  isBandInDetail = false,
}: Props) => (
  <div data-studio-skeleton={skeleton.shape} className="flex min-h-0 min-w-0 flex-1 bg-background">
    {skeleton.hasRail ? (
      <div
        data-studio-skeleton-rail=""
        style={{ width: railWidthPx }}
        className="flex shrink-0 flex-col gap-3 bg-subtle px-4 py-6"
      >
        {RAIL_ITEMS.map((item) => (
          <Skeleton key={item} className="h-3 w-3/4" />
        ))}
      </div>
    ) : null}
    <div
      className="flex min-w-0 flex-1 flex-col"
      style={skeleton.hasRail && isBandInDetail ? { paddingTop: FRAME_BAND_PX } : undefined}
    >
      <PageSkeleton
        label={`Loading ${title}`}
        hasTitle={page !== null}
        {...(page !== null && { page })}
      >
        {STUDIO_SKELETON_BODIES[skeleton.shape]}
      </PageSkeleton>
    </div>
  </div>
);
