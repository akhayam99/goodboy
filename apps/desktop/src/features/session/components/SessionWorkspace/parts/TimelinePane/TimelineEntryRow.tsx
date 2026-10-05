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
import type { DecisionChangeDetail } from '../../../../timeline/decisionChangeLines';
import type {
  TimelineRowItem,
  TimelineStreamEntry,
} from '../../../../timeline/buildTimelineStream';
import { DecisionChangesDetail } from './DecisionChangesDetail';
import type { GroupTotals } from '../../../../timeline/groupTotals';
import { TimelineAgentStreamRow } from './TimelineAgentStreamRow';
import { TimelineFoldStreamRow } from './TimelineFoldStreamRow';
import { TimelineGroupMeta } from './TimelineGroupMeta';
import { TimelineGroupStreamRow } from './TimelineGroupStreamRow';
import type { TimelineLaneTarget } from './TimelineRail';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineRunStreamRow } from './TimelineRunStreamRow';
import { TimelineStreamRow, type TimelineRowAction } from './TimelineStreamRow';

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
  readonly runLane: TimelineLaneTarget | null;
  readonly handlers: TimelineEntryRowHandlers;
  readonly actionLabel: string | null;
  readonly actionVariant: TimelineRowAction['variant'] | null;
  readonly actionBusy: boolean;
  readonly diffStat: MountDiffStat | null;
  readonly worktrees: ReadonlyArray<string>;
  readonly step: Step | null;
  readonly costUsd: number;
  readonly groupTotals: GroupTotals | null;
  readonly isExpanded: boolean;
  readonly isOutputsExpanded: boolean;
  readonly decisionDetail: DecisionChangeDetail | null;
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
  actionLabel,
  actionVariant,
  actionBusy,
  diffStat,
  worktrees,
  step,
  costUsd,
  groupTotals,
  isExpanded,
  isOutputsExpanded,
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
        onSetExpanded={handlers.setGroupExpanded}
      />
    );
  }
  if (item.fold !== undefined && (entry.kind === 'agent' || entry.kind === 'run')) {
    return (
      <TimelineFoldStreamRow
        item={item}
        entry={entry}
        rail={rail}
        railWidth={railWidth}
        sessionId={sessionId}
        isExpanded={isExpanded}
        totals={groupTotals}
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
        isSubagentsExpanded={isExpanded}
        isOutputsExpanded={isOutputsExpanded}
        onSetSubagents={handlers.setGroupExpanded}
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
            detail={decisionDetail}
            onOpenInContext={() =>
              handlers.openDecisionInContext({ numbers: decisionDetail.numbers })
            }
          />
        ) : null
      }
      action={action}
      diffStat={diffStat}
      runLane={runLane}
      {...(entry.kind === 'resolveFile'
        ? {
            state: <TimelineRowStateLine state={item.rowState} />,
            meta: <TimelineGroupMeta totals={{ costUsd, time: null }} />,
          }
        : {})}
    />
  );
};
