import { cn } from '@goodboy/ui';
import type { TimelineNowItem } from '../../../../timeline/buildTimelineStream';
import type { RailRow } from '../../../../timeline/railGeometry';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly item: TimelineNowItem;
  readonly rail: RailRow;
  readonly railWidth: number;
};

export const TimelineNowRule = ({ item, rail, railWidth }: Props) => (
  <div className="flex min-w-0" style={{ height: item.height }}>
    <span className={cn('relative shrink-0', TIMELINE_GUTTER)}>
      <span
        className="absolute right-2 -translate-y-1/2 text-3xs font-medium uppercase tracking-eyebrow text-muted-foreground"
        style={{ top: item.ruleY }}
      >
        Now
      </span>
    </span>
    <span className="relative shrink-0" style={{ width: railWidth }}>
      <TimelineRail rail={rail} width={railWidth} />
    </span>
    <span className="relative min-w-0 flex-1">
      <span
        className="absolute left-2 right-0 border-t border-dashed border-border-soft"
        style={{ top: item.ruleY }}
        aria-hidden
      />
    </span>
  </div>
);
