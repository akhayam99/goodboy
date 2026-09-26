import type { KeyboardEvent, ReactNode } from 'react';
import { Button, WORK_META_COLUMN, WORK_ROW, cn, tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../../store';
import { formatCardTime } from '../../../../../chat/utils/format-card-time';
import { useHoverMarkViewed } from '../../../../hooks/useHoverMarkViewed';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import { railColumnX, type RailRow } from '../../../../../workTreeModel/railGeometry';
import { TIMELINE_RHYTHM } from '../../../../../workTreeModel/timelineRhythm';
import { isRowStoppedByUser } from '../../../../../workTreeModel/rowStateCopy';
import { eventMatches } from '../../../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../../../shared/keyboard/registry';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineRail, type TimelineLaneControl, type TimelineLaneTarget } from './TimelineRail';
import { TimelineRowLabel } from './TimelineRowLabel';
import { TimelineRowMarker } from './TimelineRowMarker';

export type TimelineRowAction = {
  readonly label: string;
  readonly onAct: () => void;
  readonly asksUser?: boolean;
};

type Props = {
  readonly item: TimelineRowItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly openTarget: TimelineOpenTarget | null;
  readonly action: TimelineRowAction | null;
  readonly diffStat?: MountDiffStat | null;
  readonly worktrees?: ReadonlyArray<string>;
  readonly meta?: ReactNode;
  readonly progress?: number | null;
  readonly stateNote?: string | null;
  readonly menu?: ReactNode;
  readonly lanes?: TimelineLaneControl | null;
  readonly runLane?: TimelineLaneTarget | null;
  readonly isRevealed?: boolean;
};

const agentIdOf = ({ item }: { readonly item: TimelineRowItem }): AgentId | null =>
  item.entry.kind === 'agent' ? item.entry.agent.id : null;

export const TimelineStreamRow = ({
  item,
  rail,
  railWidth,
  sessionId,
  openTarget,
  action,
  diffStat = null,
  worktrees,
  meta = null,
  progress = null,
  stateNote = null,
  menu = null,
  lanes = null,
  runLane = null,
  isRevealed = false,
}: Props) => {
  const hover = useHoverMarkViewed({
    sessionId,
    agentId: agentIdOf({ item }),
    hasUnread: item.hasUnread,
  });
  const boxHeight = TIMELINE_RHYTHM.grade[item.grade].height;
  const isWaiting =
    item.rowState.phase === 'waiting' && !isRowStoppedByUser({ state: item.rowState });
  const isLaneLit = runLane !== null && lanes?.hoveredLaneId === runLane.laneId;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (runLane === null) {
      return;
    }
    if (!eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['activity.openRun'] })) {
      return;
    }
    event.preventDefault();
    runLane.open();
  };
  const contentClassName = cn(
    'flex min-w-0 flex-1 items-center gap-2 rounded-md pl-2 pr-1.5 text-left',
    openTarget == null
      ? null
      : 'motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
    isWaiting && tintClasses('warning').bgSoft,
    !isWaiting && item.hasUnread && tintClasses('primary').bgSoft,
  );
  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
        <TimelineRowLabel
          item={item}
          diffStat={diffStat}
          isLaneLit={isLaneLit}
          worktrees={worktrees}
          stateNote={stateNote}
          isRevealed={isRevealed}
        />
      </span>
      {openTarget == null ? null : (
        <span className={cn('shrink-0 text-meta text-muted-foreground', WORK_ROW.hint)}>
          {`${openTarget.label} ↵`}
        </span>
      )}
      {meta}
    </>
  );

  return (
    <div
      data-row-id={item.id}
      className="group flex min-w-0"
      style={{ height: item.height }}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
    >
      <span className={cn('flex shrink-0 flex-col justify-end', TIMELINE_GUTTER)}>
        <span
          className="flex items-center justify-end pr-2 text-meta text-faint-foreground"
          style={{ height: boxHeight }}
        >
          {item.at == null ? null : formatCardTime(item.at)}
        </span>
      </span>
      <span className="relative shrink-0" style={{ width: railWidth }}>
        <TimelineRail rail={rail} width={railWidth} lanes={lanes} />
        {rail.markerY == null ? null : (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: railColumnX({ column: rail.markerColumn }),
              top: rail.markerY,
            }}
          >
            <TimelineRowMarker item={item} progress={progress} />
          </span>
        )}
      </span>
      <div
        className={cn(
          WORK_ROW.container,
          'flex min-w-0 flex-1 items-end gap-1',
          item.grade !== 'entry' && 'pr-1',
        )}
      >
        {openTarget == null ? (
          <div className={contentClassName} style={{ height: boxHeight }}>
            {content}
          </div>
        ) : (
          <button
            type="button"
            onClick={openTarget.open}
            onKeyDown={onKeyDown}
            aria-keyshortcuts={runLane === null ? undefined : 'Shift+Enter'}
            className={contentClassName}
            style={{ height: boxHeight }}
          >
            {content}
          </button>
        )}
        <span
          data-testid={action == null ? undefined : 'timeline-row-action'}
          className={WORK_META_COLUMN.action}
          style={{ height: boxHeight }}
        >
          {action == null ? null : (
            <Button
              variant={action.asksUser === true ? 'warning' : 'ghost'}
              emphasis={action.asksUser === true ? 'outline' : 'solid'}
              size="sm"
              className="h-6"
              onClick={action.onAct}
            >
              {action.label}
            </Button>
          )}
        </span>
        <span className={WORK_META_COLUMN.menu} style={{ height: boxHeight }}>
          {menu}
        </span>
      </div>
    </div>
  );
};
