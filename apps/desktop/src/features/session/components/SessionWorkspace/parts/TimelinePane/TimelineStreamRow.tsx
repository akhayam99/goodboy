import { Button, cn, tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../../store';
import { formatCardTime } from '../../../../../chat/utils/format-card-time';
import { useHoverMarkViewed } from '../../../../hooks/useHoverMarkViewed';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import { railColumnX, type RailRow } from '../../../../timeline/railGeometry';
import { TIMELINE_RHYTHM } from '../../../../timeline/timelineRhythm';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineRail } from './TimelineRail';
import { TimelineRowLabel } from './TimelineRowLabel';
import { TimelineRowMarker } from './TimelineRowMarker';

export type TimelineRowAction = {
  readonly label: string;
  readonly onAct: () => void;
};

type Props = {
  readonly item: TimelineRowItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly openTarget: TimelineOpenTarget | null;
  readonly action: TimelineRowAction | null;
  readonly diffStat?: MountDiffStat | null;
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
}: Props) => {
  const hover = useHoverMarkViewed({
    sessionId,
    agentId: agentIdOf({ item }),
    hasUnread: item.hasUnread,
  });
  const boxHeight = TIMELINE_RHYTHM.grade[item.grade].height;
  const needsUser = item.markerState === 'needsUser' || item.markerState === 'question';
  const contentClassName = cn(
    'flex min-w-0 flex-1 items-center gap-2 rounded-md pl-2 pr-1.5 text-left',
    openTarget == null
      ? null
      : 'motion-safe:transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
    needsUser && tintClasses('warning').bgSoft,
    !needsUser && item.hasUnread && tintClasses('primary').bgSoft,
  );
  const content = (
    <>
      <TimelineRowLabel item={item} diffStat={diffStat} />
      {openTarget == null ? null : (
        <span className="shrink-0 text-3xs text-muted-foreground opacity-0 motion-safe:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {`${openTarget.label} ↵`}
        </span>
      )}
    </>
  );

  return (
    <div
      className="group flex min-w-0"
      style={{ height: item.height }}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
    >
      <span className={cn('flex shrink-0 flex-col justify-end', TIMELINE_GUTTER)}>
        <span
          className="flex items-center justify-end pr-2 text-3xs tabular-nums text-muted-foreground/70"
          style={{ height: boxHeight }}
        >
          {item.at == null ? null : formatCardTime(item.at)}
        </span>
      </span>
      <span className="relative shrink-0" style={{ width: railWidth }}>
        <TimelineRail rail={rail} width={railWidth} />
        {rail.markerY == null ? null : (
          <span
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: railColumnX({ column: rail.markerColumn }),
              top: rail.markerY,
            }}
          >
            <TimelineRowMarker item={item} />
          </span>
        )}
      </span>
      <div className={cn('flex min-w-0 flex-1 items-end gap-1', item.grade === 'step' && 'pr-1')}>
        {openTarget == null ? (
          <div className={contentClassName} style={{ height: boxHeight }}>
            {content}
          </div>
        ) : (
          <button
            type="button"
            onClick={openTarget.open}
            className={contentClassName}
            style={{ height: boxHeight }}
          >
            {content}
          </button>
        )}
        {action == null ? null : (
          <span
            data-testid="timeline-row-action"
            className="flex shrink-0 items-center"
            style={{ height: boxHeight }}
          >
            <Button variant="ghost" size="sm" className="h-6" onClick={action.onAct}>
              {action.label}
            </Button>
          </span>
        )}
      </div>
    </div>
  );
};
