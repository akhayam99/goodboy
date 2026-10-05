import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import { Button, Tooltip, WORK_ROW, cn, tintClasses, useEscapeLayer } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../../store';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import { useHoverMarkViewed } from '../../../../hooks/useHoverMarkViewed';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import { railColumnX, type RailRow } from '../../../../../workTreeModel/railGeometry';
import { TIMELINE_RHYTHM } from '../../../../../workTreeModel/timelineRhythm';
import { rowStateTone } from '../../../../../workTreeModel/rowStateCopy';
import { eventMatches } from '../../../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../../../shared/keyboard/registry';
import { TIMELINE_GUTTER } from './timelineLayout';
import { clockTooltipOf, isClocklessRow } from './timelineClock';
import type { TimelineRowIdentity } from './timelineRowIdentity';
import { TimelineRail, type TimelineLaneTarget } from './TimelineRail';
import { TimelineRowLabel } from './TimelineRowLabel';
import { TimelineRowMarker } from './TimelineRowMarker';

type TimelineRowExpansion = {
  readonly isExpanded: boolean;
  readonly controlsId: string | null;
  readonly onSet?: (params: { readonly isExpanded: boolean }) => void;
};

export type TimelineRowAction = {
  readonly label: string;
  readonly onAct: () => void;
  readonly variant?: 'secondary' | 'warning';
  readonly isBusy?: boolean;
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
  readonly state?: ReactNode;
  readonly progress?: number | null;
  readonly subagents?: ReactNode;
  readonly outputs?: ReactNode;
  readonly runLane?: TimelineLaneTarget | null;
  readonly detail?: ReactNode;
  readonly detailHeight?: number;
  readonly expansion?: TimelineRowExpansion | null;
  readonly contextMenu?: ObjectMenuTrigger;
  readonly identity?: TimelineRowIdentity | null;
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
  state = null,
  progress = null,
  subagents = null,
  outputs = null,
  runLane = null,
  detail = null,
  detailHeight = 0,
  expansion = null,
  contextMenu,
  identity = null,
}: Props) => {
  const [isCardOpen, setIsCardOpen] = useState(false);
  useEscapeLayer(() => setIsCardOpen(false), isCardOpen);
  const hover = useHoverMarkViewed({
    sessionId,
    agentId: agentIdOf({ item }),
    hasUnread: item.hasUnread,
  });
  const boxHeight = TIMELINE_RHYTHM.grade[item.grade].height;
  const isWaiting =
    item.rowState.phase === 'waiting' &&
    item.rowState.ask?.kind !== 'reviewComment' &&
    item.rowState.ask?.kind !== 'groupChild' &&
    rowStateTone({ state: item.rowState }) === 'warning';
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const isPlainKey = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    if (identity !== null && isPlainKey && event.key === 'i') {
      event.preventDefault();
      setIsCardOpen((isOpen) => !isOpen);
      return;
    }
    if (expansion?.onSet !== undefined) {
      if (event.key === 'ArrowRight' && !expansion.isExpanded) {
        event.preventDefault();
        expansion.onSet({ isExpanded: true });
        return;
      }
      if (event.key === 'ArrowLeft' && expansion.isExpanded) {
        event.preventDefault();
        expansion.onSet({ isExpanded: false });
        return;
      }
    }
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
    'flex min-w-0 flex-1 items-center gap-2 rounded-md pl-2 pr-2 text-left',
    openTarget == null
      ? null
      : 'motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
    isWaiting && tintClasses('warning').bgSoft,
    !isWaiting && item.hasUnread && tintClasses('primary').bgSoft,
  );
  const content = (
    <>
      <span className={cn('flex flex-1 items-baseline gap-2 overflow-hidden', WORK_ROW.label)}>
        <TimelineRowLabel
          item={item}
          diffStat={diffStat}
          worktrees={worktrees}
          identity={identity}
          isCardOpen={isCardOpen}
        />
      </span>
      {state}
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
      onContextMenu={contextMenu?.onContextMenu}
      onKeyDown={contextMenu?.onKeyDown}
    >
      <span
        className={cn('flex shrink-0 flex-col justify-end', TIMELINE_GUTTER)}
        style={{ paddingBottom: detailHeight }}
      >
        <span
          className="flex items-center justify-end pr-2 text-meta text-faint-foreground"
          style={{ height: boxHeight }}
        >
          {item.at == null || isClocklessRow({ item }) ? null : (
            <Tooltip content={clockTooltipOf({ item })}>
              <span>{formatClock({ at: item.at })}</span>
            </Tooltip>
          )}
        </span>
      </span>
      <span className="relative shrink-0" style={{ width: railWidth }}>
        <TimelineRail rail={rail} width={railWidth} />
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
      <div className="flex min-w-0 flex-1 flex-col">
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
              onBlur={() => setIsCardOpen(false)}
              aria-description={`${openTarget.label}, Enter`}
              aria-keyshortcuts={runLane === null ? undefined : 'Shift+Enter'}
              aria-expanded={expansion === null ? undefined : expansion.isExpanded}
              aria-controls={
                expansion === null || !expansion.isExpanded
                  ? undefined
                  : (expansion.controlsId ?? undefined)
              }
              className={contentClassName}
              style={{ height: boxHeight }}
            >
              {content}
            </button>
          )}
          {subagents}
          {outputs}
          {action == null ? null : (
            <span
              data-testid="timeline-row-action"
              data-action-slot
              className="flex shrink-0 items-center"
              style={{ height: boxHeight }}
            >
              <Button
                variant={action.variant ?? 'ghost'}
                emphasis={action.variant === 'warning' ? 'outline' : 'solid'}
                size="sm"
                className="h-6"
                isBusy={action.isBusy === true}
                onClick={action.onAct}
              >
                {action.label}
              </Button>
            </span>
          )}
        </div>
        {detail}
      </div>
    </div>
  );
};
