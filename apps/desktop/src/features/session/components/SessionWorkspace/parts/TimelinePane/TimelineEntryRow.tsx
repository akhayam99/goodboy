import type {
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
} from '@goodboy/types';
import type { MountDiffStat } from '../../../../../../store';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import type {
  DecisionChangeDetail,
  DetailHeightParams,
} from '../../../../timeline/decisionChangeLines';
import type {
  TimelineRowItem,
  TimelineStreamEntry,
} from '../../../../timeline/buildTimelineStream';
import type { HistoryBatchDetail as HistoryBatchDetailModel } from '../../../../timeline/historyBatchDetail';
import { DecisionChangesDetail } from './DecisionChangesDetail';
import { HistoryBatchDetail } from './HistoryBatchDetail';
import { TimelineAgentStreamRow } from './TimelineAgentStreamRow';
import type { TimelineLaneControl, TimelineLaneTarget } from './TimelineRail';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineRunStreamRow } from './TimelineRunStreamRow';
import { TimelineStreamRow, type TimelineRowAction } from './TimelineStreamRow';
import { timelineBranchKey } from './timelineBranchKey';

export type TimelineEntryRowHandlers = {
  readonly openTargetFor: (params: {
    readonly entry: TimelineStreamEntry;
  }) => TimelineOpenTarget | null;
  readonly runAction: (params: { readonly item: TimelineRowItem }) => void;
  readonly openDecisionInContext: (params: { readonly numbers: ReadonlyArray<number> }) => void;
  readonly toggleExpanded: (rowId: string) => void;
  readonly setDetailHeight: (params: DetailHeightParams) => void;
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
  readonly runLane: TimelineLaneTarget | null;
  readonly lanes: TimelineLaneControl | null;
  readonly handlers: TimelineEntryRowHandlers;
  readonly actionLabel: string | null;
  readonly actionVariant: TimelineRowAction['variant'] | null;
  readonly actionBusy: boolean;
  readonly diffStat: MountDiffStat | null;
  readonly worktrees: ReadonlyArray<string>;
  readonly step: Step | null;
  readonly costUsd: number;
  readonly isExpanded: boolean;
  readonly isBranchExpanded: boolean;
  readonly decisionDetail: DecisionChangeDetail | null;
  readonly batchDetail: HistoryBatchDetailModel | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
};

export const TimelineEntryRow = ({
  item,
  rail,
  railWidth,
  sessionId,
  handlers,
  runLane,
  lanes,
  actionLabel,
  actionVariant,
  actionBusy,
  diffStat,
  worktrees,
  step,
  costUsd,
  isExpanded,
  isBranchExpanded,
  decisionDetail,
  batchDetail,
  roleModels,
  sessionProvider,
  sessionEffort,
}: TimelineEntryRowProps) => {
  const { entry } = item;
  const branchKey = timelineBranchKey({
    item,
    isBranchExpanded,
    onSet: handlers.setGroupExpanded,
  });
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
        openTarget={target}
        action={action}
        diffStat={diffStat}
        worktrees={worktrees}
        runLane={runLane}
        step={step}
        roleModels={roleModels}
        sessionProvider={sessionProvider}
        sessionEffort={sessionEffort}
        costUsd={costUsd}
        lanes={lanes}
        onBranchKey={branchKey}
      />
    );
  }
  if (entry.kind === 'run') {
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
        runLane={runLane}
        roleModels={roleModels}
        sessionProvider={sessionProvider}
        sessionEffort={sessionEffort}
        costUsd={costUsd}
        lanes={lanes}
        onBranchKey={branchKey}
      />
    );
  }
  if (batchDetail !== null) {
    const batchId = `${item.id}-history-batch`;
    return (
      <TimelineStreamRow
        item={item}
        rail={rail}
        railWidth={railWidth}
        sessionId={sessionId}
        openTarget={{
          label: isExpanded ? 'Hide branches' : 'Show branches',
          open: () => handlers.toggleExpanded(item.id),
        }}
        expansion={{ isExpanded, controlsId: batchId }}
        detailHeight={isExpanded ? batchDetail.height : 0}
        detail={
          isExpanded ? (
            <HistoryBatchDetail
              id={batchId}
              rowId={item.id}
              detail={batchDetail}
              onMeasured={handlers.setDetailHeight}
            />
          ) : null
        }
        action={action}
        diffStat={diffStat}
        runLane={runLane}
        lanes={lanes}
        onBranchKey={branchKey}
      />
    );
  }
  const detailId = `${item.id}-decision-changes`;
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
            rowId={item.id}
            detail={decisionDetail}
            onMeasured={handlers.setDetailHeight}
            onOpenInContext={() =>
              handlers.openDecisionInContext({ numbers: decisionDetail.numbers })
            }
          />
        ) : null
      }
      action={action}
      diffStat={diffStat}
      runLane={runLane}
      lanes={lanes}
      onBranchKey={branchKey}
    />
  );
};
