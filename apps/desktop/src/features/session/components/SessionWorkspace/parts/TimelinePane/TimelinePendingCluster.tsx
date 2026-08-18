import { Clock } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { TimelineClusterItem } from '../../../../timeline/buildTimelineStream';
import { railColumnX, type RailRow } from '../../../../timeline/railGeometry';
import { TIMELINE_RHYTHM } from '../../../../timeline/timelineRhythm';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineGlyphMarker } from './TimelineGlyphMarker';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly item: TimelineClusterItem;
  readonly rail: RailRow;
  readonly railWidth: number;
};

export const TimelinePendingCluster = ({ item, rail, railWidth }: Props) => {
  const { height, glyphSize } = TIMELINE_RHYTHM.grade.pending;
  return (
    <div className="flex min-w-0" style={{ height: item.height }}>
      <span className={cn('shrink-0', TIMELINE_GUTTER)} />
      <span className="relative shrink-0" style={{ width: railWidth }}>
        <TimelineRail rail={rail} width={railWidth} />
        {rail.markerY == null ? null : (
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: railColumnX({ column: rail.markerColumn }), top: rail.markerY }}
          >
            <TimelineGlyphMarker tone="neutral" grade="pending">
              <Clock
                size={glyphSize}
                aria-label={`${item.steps.length} steps not started`}
                className="text-muted-foreground/60"
              />
            </TimelineGlyphMarker>
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-end">
        {item.steps.map((step) => (
          <span
            key={step.id}
            className="flex min-w-0 items-center gap-2 pl-2 text-3xs text-muted-foreground/60"
            style={{ height }}
          >
            {step.stepLabel == null ? null : (
              <span className="w-4 shrink-0 text-right tabular-nums">{step.stepLabel}</span>
            )}
            <span className="min-w-0 truncate">{step.agent.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
};
