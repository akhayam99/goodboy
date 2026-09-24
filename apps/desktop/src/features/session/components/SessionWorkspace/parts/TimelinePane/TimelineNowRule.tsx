import { cn } from '@goodboy/ui';
import type { TimelineNowItem } from '../../../../timeline/buildTimelineStream';
import { RAIL_SPINE_X, type RailRow } from '../../../../../workTreeModel/railGeometry';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly item: TimelineNowItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly hasGutter?: boolean;
};

const LABEL_CLASS =
  'absolute -translate-y-1/2 text-3xs font-medium uppercase tracking-eyebrow text-muted-foreground';

export const TimelineNowRule = ({ item, rail, railWidth, hasGutter = true }: Props) => (
  <div className="flex min-w-0" style={{ height: item.height }}>
    {hasGutter && (
      <span className={cn('relative shrink-0', TIMELINE_GUTTER)}>
        <span className={cn(LABEL_CLASS, 'right-2')} style={{ top: item.ruleY }}>
          Now
        </span>
      </span>
    )}
    <span className="relative shrink-0" style={{ width: railWidth }}>
      <TimelineRail rail={rail} width={railWidth} />
      <span
        data-testid="timeline-now-dot"
        aria-hidden
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
        style={{ left: RAIL_SPINE_X, top: item.ruleY }}
      />
    </span>
    <span className="relative min-w-0 flex-1">
      {hasGutter ? null : (
        <span className={cn(LABEL_CLASS, 'left-2')} style={{ top: item.ruleY }}>
          Now
        </span>
      )}
    </span>
  </div>
);
