import { cn } from '@goodboy/ui';
import type { TimelineMoreItem } from '../../../../timeline/buildTimelineStream';
import { railColumnX, type RailRow } from '../../../../../workTreeModel/railGeometry';
import { TIMELINE_RHYTHM } from '../../../../../workTreeModel/timelineRhythm';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly item: TimelineMoreItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly onShowAll: (params: { readonly id: string }) => void;
};

export const TimelineMoreRow = ({ item, rail, railWidth, onShowAll }: Props) => (
  <div data-row-id={item.id} className="flex min-w-0" style={{ height: item.height }}>
    <span className={cn('shrink-0', TIMELINE_GUTTER)} />
    <span className="relative shrink-0" style={{ width: railWidth }}>
      <TimelineRail rail={rail} width={railWidth} />
      {rail.markerY == null ? null : (
        <span
          aria-hidden
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border"
          style={{ left: railColumnX({ column: rail.markerColumn }), top: rail.markerY }}
        />
      )}
    </span>
    <div className="flex min-w-0 flex-1 items-end">
      <button
        type="button"
        onClick={() => onShowAll({ id: item.explode.groupId })}
        className="flex min-w-0 items-center rounded-md pl-2 pr-2 text-label text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        style={{ height: TIMELINE_RHYTHM.grade.fact.height }}
      >
        {`Show ${item.hiddenCount} more`}
      </button>
    </div>
  </div>
);
