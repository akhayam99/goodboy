import { OverflowMenu } from '@goodboy/ui';
import type {
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
} from '@goodboy/types';
import type { MountDiffStat } from '../../../../../../store';
import { ObjectOverflowMenu } from '../../../../../actions/components/ObjectOverflowMenu';
import type { HistoryRowActions } from '../../../../../history/useHistoryRowActions';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import type { DecisionChangeDetail } from '../../../../timeline/decisionChangeLines';
import type {
  TimelineRowItem,
  TimelineStreamEntry,
} from '../../../../timeline/buildTimelineStream';
import { DecisionChangesDetail } from './DecisionChangesDetail';
import type { GroupTotals } from '../../../../timeline/groupTotals';
import { TimelineAgentStreamRow } from './TimelineAgentStreamRow';
import { TimelineFoldAgentStreamRow } from './TimelineFoldAgentStreamRow';
import { TimelineFoldStreamRow } from './TimelineFoldStreamRow';
import { TimelineGroupStreamRow } from './TimelineGroupStreamRow';
import type { TimelineLaneControl } from './TimelineRail';
import { TimelineRunStreamRow } from './TimelineRunStreamRow';
import { TimelineStreamRow, type TimelineRowAction } from './TimelineStreamRow';

const BATCH_CHILD_OPEN_LABEL = 'Open brief';

export type TimelineEntryRowHandlers = {
  readonly openTargetFor: (params: {
    readonly entry: TimelineStreamEntry;
  }) => TimelineOpenTarget | null;
  readonly runAction: (params: { readonly item: TimelineRowItem }) => void;
  readonly openDecisionInContext: (params: { readonly numbers: ReadonlyArray<number> }) => void;
  readonly toggleExpanded: (rowId: string) => void;
  readonly setGroupExpanded: (params: {
    readonly id: string;
    readonly isExpanded: boolean;
  }) => void;
};

export type TimelineEntryRowProps = {
  readonly item: TimelineRowItem;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly lanes: TimelineLaneControl;
  readonly handlers: TimelineEntryRowHandlers;
  readonly runLaneId: string | null;
  readonly actionLabel: string | null;
  readonly actionVariant: TimelineRowAction['variant'] | null;
  readonly actionBusy: boolean;
  readonly historyMenu: HistoryRowActions['menu'] | null;
  readonly diffStat: MountDiffStat | null;
  readonly worktrees: ReadonlyArray<string>;
  readonly step: Step | null;
  readonly costUsd: number;
  readonly groupTotals: GroupTotals | null;
  readonly isRevealed: boolean;
  readonly isExpanded: boolean;
  readonly decisionDetail: DecisionChangeDetail | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
};

const openTargetOfBatchChild = ({
  item,
  target,
}: {
  readonly item: TimelineRowItem;
  readonly target: TimelineOpenTarget | null;
}): TimelineOpenTarget | null =>
  item.explode?.kind !== 'batch' || target === null
    ? target
    : { ...target, label: BATCH_CHILD_OPEN_LABEL };

export const TimelineEntryRow = ({
  item,
  rail,
  railWidth,
  sessionId,
  lanes,
  handlers,
  runLaneId,
  actionLabel,
  actionVariant,
  actionBusy,
  historyMenu,
  diffStat,
  worktrees,
  step,
  costUsd,
  groupTotals,
  isRevealed,
  isExpanded,
  decisionDetail,
  roleModels,
  sessionProvider,
  sessionEffort,
}: TimelineEntryRowProps) => {
  const { entry } = item;
  if (entry.kind === 'resolveBatch') {
    return (
      <TimelineGroupStreamRow
        item={item}
        entry={entry}
        rail={rail}
        railWidth={railWidth}
        sessionId={sessionId}
        isExpanded={isExpanded}
        totals={groupTotals}
        lanes={lanes}
        onSetExpanded={handlers.setGroupExpanded}
      />
    );
  }
  const runLane = runLaneId === null ? null : lanes.targetFor({ laneId: runLaneId });
  if (item.fold !== undefined && entry.kind === 'agent') {
    return (
      <TimelineFoldAgentStreamRow
        item={item}
        entry={entry}
        rail={rail}
        railWidth={railWidth}
        sessionId={sessionId}
        isExpanded={isExpanded}
        totals={groupTotals}
        lanes={lanes}
        runLane={runLane}
        onSetExpanded={handlers.setGroupExpanded}
      />
    );
  }
  if (item.fold !== undefined && entry.kind === 'run') {
    return (
      <TimelineFoldStreamRow
        item={item}
        entry={entry}
        rail={rail}
        railWidth={railWidth}
        sessionId={sessionId}
        isExpanded={isExpanded}
        totals={groupTotals}
        lanes={lanes}
        runLane={runLane}
        onSetExpanded={handlers.setGroupExpanded}
      />
    );
  }
  const target = handlers.openTargetFor({ entry });
  const action: TimelineRowAction | null =
    actionLabel === null
      ? null
      : {
          label: actionLabel,
          onAct: () => handlers.runAction({ item }),
          ...(actionVariant !== null && { variant: actionVariant }),
          ...(actionBusy && { isBusy: true }),
        };
  if (entry.kind === 'agent') {
    return (
      <TimelineAgentStreamRow
        item={item}
        entry={entry}
        rail={rail}
        railWidth={railWidth}
        sessionId={sessionId}
        openTarget={openTargetOfBatchChild({ item, target })}
        action={action}
        diffStat={diffStat}
        worktrees={worktrees}
        isRevealed={isRevealed}
        lanes={lanes}
        runLane={runLane}
        step={step}
        roleModels={roleModels}
        sessionProvider={sessionProvider}
        sessionEffort={sessionEffort}
        costUsd={costUsd}
        isSubagentsExpanded={isExpanded}
        onSetSubagents={handlers.setGroupExpanded}
      />
    );
  }
  if (entry.kind === 'run') {
    const { run, workflow } = entry;
    return (
      <TimelineRunStreamRow
        item={item}
        entry={entry}
        rail={rail}
        railWidth={railWidth}
        sessionId={sessionId}
        openTarget={target}
        action={action}
        diffStat={diffStat}
        isRevealed={isRevealed}
        lanes={lanes}
        runLane={runLane}
        roleModels={roleModels}
        sessionProvider={sessionProvider}
        sessionEffort={sessionEffort}
        costUsd={costUsd}
        menu={
          <ObjectOverflowMenu
            target={{ kind: 'workflowRun', sessionId, runId: run.id }}
            label={`${run.title ?? workflow.name} workflow actions`}
            anchorKey={`activity:${item.id}`}
            triggerClassName="size-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100 motion-safe:transition-opacity"
          />
        }
      />
    );
  }
  const detailId = `${item.id}-decision-changes`;
  const menu =
    historyMenu === null || historyMenu.length === 0 ? null : (
      <OverflowMenu
        items={historyMenu}
        label="More for this rewrite"
        triggerClassName="size-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 motion-safe:transition-opacity"
      />
    );
  return (
    <TimelineStreamRow
      item={item}
      rail={rail}
      railWidth={railWidth}
      sessionId={sessionId}
      openTarget={
        decisionDetail === null
          ? target
          : {
              label: isExpanded ? 'Hide changes' : 'Show changes',
              open: () => handlers.toggleExpanded(item.id),
            }
      }
      expansion={decisionDetail === null ? null : { isExpanded, controlsId: detailId }}
      detailHeight={decisionDetail !== null && isExpanded ? decisionDetail.height : 0}
      detail={
        decisionDetail !== null && isExpanded ? (
          <DecisionChangesDetail
            id={detailId}
            detail={decisionDetail}
            onOpenInContext={() =>
              handlers.openDecisionInContext({ numbers: decisionDetail.numbers })
            }
          />
        ) : null
      }
      action={action}
      diffStat={diffStat}
      isRevealed={isRevealed}
      lanes={lanes}
      runLane={runLane}
      menu={menu}
    />
  );
};
