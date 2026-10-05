import type { KeyboardEvent } from 'react';
import { cn } from '@goodboy/ui';
import type { TimelineCountItem } from '../../../../timeline/buildTimelineStream';
import { groupSummaryText } from '../../../../timeline/groupSummary';
import { runIdentityStroke } from '../../../../timeline/runIdentity';
import { railColumnX, type RailRow } from '../../../../../workTreeModel/railGeometry';
import { TIMELINE_RHYTHM } from '../../../../../workTreeModel/timelineRhythm';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineFoldSummary } from './TimelineFoldSummary';
import { TimelineRail, type TimelineLaneControl } from './TimelineRail';

type Props = {
  readonly item: TimelineCountItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly lanes: TimelineLaneControl | null;
  readonly isExpanded: boolean;
  readonly onSet: (params: { readonly id: string; readonly isExpanded: boolean }) => void;
};

const STEP_ALIGNED: ReadonlyArray<TimelineCountItem['branchKind']> = ['steps', 'subagents'];

export const TimelineCountRow = ({ item, rail, railWidth, lanes, isExpanded, onSet }: Props) => {
  const label = groupSummaryText({ summary: item.summary });
  const set = ({ isExpanded: next }: { readonly isExpanded: boolean }) =>
    onSet({ id: item.expandId, isExpanded: next });
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' && !isExpanded) {
      event.preventDefault();
      set({ isExpanded: true });
      return;
    }
    if (event.key === 'ArrowLeft' && isExpanded) {
      event.preventDefault();
      set({ isExpanded: false });
    }
  };
  return (
    <div data-row-id={item.id} className="flex min-w-0" style={{ height: item.height }}>
      <span className={cn('shrink-0', TIMELINE_GUTTER)} />
      <span className="relative shrink-0" style={{ width: railWidth }}>
        <TimelineRail rail={rail} width={railWidth} lanes={lanes} />
        {rail.markerY == null ? null : (
          <span
            aria-hidden
            data-testid="timeline-count-node"
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background"
            style={{
              left: railColumnX({ column: rail.markerColumn }),
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
          aria-expanded={isExpanded}
          aria-label={`${label}, ${isExpanded ? 'fold' : 'expand'}`}
          onClick={() => set({ isExpanded: !isExpanded })}
          onKeyDown={onKeyDown}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md pl-2 pr-2 text-left',
            'motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          )}
          style={{ height: TIMELINE_RHYTHM.grade.count.height }}
        >
          {STEP_ALIGNED.includes(item.branchKind) ? (
            <>
              <span aria-hidden className="w-6 shrink-0" />
              <span aria-hidden className="w-[18px] shrink-0" />
            </>
          ) : null}
          <TimelineFoldSummary summary={item.summary} />
        </button>
      </div>
    </div>
  );
};
