import { Divider, cn } from '@goodboy/ui';
import type { TimelineDayItem } from '../../../../timeline/buildTimelineStream';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import { TIMELINE_GUTTER, TIMELINE_GUTTER_FALLBACK } from './timelineLayout';
import { TimelineRail, type TimelineLaneControl } from './TimelineRail';

type Props = {
  readonly item: TimelineDayItem;
  readonly railWidth: number;
  readonly rail: RailRow;
  readonly lanes?: TimelineLaneControl | null;
};

export const TimelineDayRule = ({ item, rail, railWidth, lanes = null }: Props) => (
  <div className="flex min-w-0 items-center" style={{ height: item.height }}>
    <span
      className={cn(
        'shrink-0 pr-2 text-secondary font-medium text-muted-foreground',
        TIMELINE_GUTTER,
      )}
    >
      {item.label}
    </span>
    <span className="relative shrink-0 self-stretch" style={{ width: railWidth }}>
      <TimelineRail rail={rail} width={railWidth} lanes={lanes} />
    </span>
    <span className="flex min-w-0 flex-1 items-center gap-2 pl-2 pr-1.5">
      <span
        className={cn(
          'shrink-0 text-secondary font-medium text-muted-foreground',
          TIMELINE_GUTTER_FALLBACK,
        )}
      >
        {item.label}
      </span>
      <Divider className="min-w-0 flex-1" />
    </span>
  </div>
);
