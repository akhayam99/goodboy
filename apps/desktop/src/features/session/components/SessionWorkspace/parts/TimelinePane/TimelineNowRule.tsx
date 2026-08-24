import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { TimelineNowItem } from '../../../../timeline/buildTimelineStream';
import { RAIL_SPINE_X, type RailRow } from '../../../../timeline/railGeometry';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly item: TimelineNowItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly action?: ReactNode;
};

export const TimelineNowRule = ({ item, rail, railWidth, action }: Props) => (
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
      <span
        data-testid="timeline-now-dot"
        aria-hidden
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
        style={{ left: RAIL_SPINE_X, top: item.ruleY }}
      />
    </span>
    <span className="relative min-w-0 flex-1">
      {action != null ? (
        <span
          className="absolute right-0 flex -translate-y-1/2 items-center"
          style={{ top: item.ruleY }}
        >
          {action}
        </span>
      ) : null}
    </span>
  </div>
);
