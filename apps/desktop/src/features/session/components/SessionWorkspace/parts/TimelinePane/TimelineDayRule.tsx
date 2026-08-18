import { Divider, cn } from '@goodboy/ui';
import type { TimelineDayItem } from '../../../../timeline/buildTimelineStream';
import type { RailRow } from '../../../../timeline/railGeometry';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly item: TimelineDayItem;
  readonly railWidth: number;
  readonly rail: RailRow;
};

export const TimelineDayRule = ({ item, rail, railWidth }: Props) => (
  <div className="flex min-w-0 items-center" style={{ height: item.height }}>
    <span
      className={cn('shrink-0 pr-2 text-2xs font-medium text-muted-foreground', TIMELINE_GUTTER)}
    >
      {item.label}
    </span>
    <span className="relative shrink-0 self-stretch" style={{ width: railWidth }}>
      <TimelineRail rail={rail} width={railWidth} />
    </span>
    <span className="flex min-w-0 flex-1 items-center pl-2 pr-1.5">
      <Divider className="min-w-0 flex-1" />
    </span>
  </div>
);
