import { Skeleton } from '@goodboy/ui';
import { TOOL_CORNER_SLOT } from './toolCornerSlot';

export const ToolCountSkeleton = () => (
  <span
    role="status"
    aria-label="Loading"
    data-testid="tool-count-skeleton"
    className={TOOL_CORNER_SLOT.end}
  >
    <Skeleton className="h-3.5 w-3.5 rounded-full" />
  </span>
);
