import type { KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ICON_SIZE, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { TimelineCountItem } from '../../../session/timeline/buildTimelineStream';
import { groupSummaryText } from '../../../session/timeline/groupSummary';
import { runIdentityStroke } from '../../../session/timeline/runIdentity';
import { TimelineRail } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineRail';
import { RAIL_COUNT_RADIUS, railColumnX, type RailRow } from '../../../workTreeModel/railGeometry';
import { TIMELINE_RHYTHM } from '../../../workTreeModel/timelineRhythm';
import { rowSlotWidth } from './rowSlotWidth';

type SetParams = {
  readonly id: string;
  readonly isExpanded: boolean;
};

type Props = {
  readonly item: TimelineCountItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly isFixed: boolean;
  readonly onSet: (params: SetParams) => void;
};

export const RunTreeFoldRow = ({ item, rail, railWidth, isFixed, onSet }: Props) => {
  const label = groupSummaryText({ summary: item.summary });
  const slot = rowSlotWidth({
    rail,
    railWidth,
    isNested: true,
    isFixed,
    markerRadius: RAIL_COUNT_RADIUS,
  });
  const markerColumn = isFixed ? Math.min(rail.markerColumn, 1) : rail.markerColumn;
  const Chevron = item.isExpanded ? ChevronUp : ChevronDown;
  const set = ({ isExpanded }: Omit<SetParams, 'id'>) => onSet({ id: item.expandId, isExpanded });
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' && !item.isExpanded) {
      event.preventDefault();
      set({ isExpanded: true });
      return;
    }
    if (event.key === 'ArrowLeft' && item.isExpanded) {
      event.preventDefault();
      set({ isExpanded: false });
    }
  };
  return (
    <div data-testid="run-tree-fold-row" className="flex min-w-0" style={{ height: item.height }}>
      <span className="relative shrink-0" style={{ width: slot }}>
        <TimelineRail rail={rail} width={slot} lanes={null} />
        {rail.markerY == null ? null : (
          <span
            aria-hidden
            data-testid="timeline-count-node"
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background"
            style={{
              left: railColumnX({ column: markerColumn }),
              top: rail.markerY,
              boxShadow: `inset 0 0 0 2px ${
                item.identityIndex === null
                  ? 'var(--color-border)'
                  : runIdentityStroke({ index: item.identityIndex })
              }`,
            }}
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 items-end">
        <button
          type="button"
          data-testid="timeline-count-row"
          aria-expanded={item.isExpanded}
          aria-label={`${label}, ${item.isExpanded ? 'fold' : 'expand'}`}
          onClick={() => set({ isExpanded: !item.isExpanded })}
          onKeyDown={onKeyDown}
          className={cn(
            'flex min-w-0 items-center gap-1 rounded-md px-2 text-left text-meta text-muted-foreground',
            ROW_INTERACTIVE,
          )}
          style={{ height: TIMELINE_RHYTHM.grade.count.height }}
        >
          <span className="min-w-0 truncate">{label}</span>
          <Chevron size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        </button>
      </div>
    </div>
  );
};
