import { useContext, useMemo } from 'react';
import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import type {
  EffortLevel,
  MeasuredTurnSpan,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
} from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import type { MountDiffStat } from '../../../../../../store';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import { WorkTimeContext } from '../../../../../workTreeModel/workTimeSource';
import { agentKindPalette } from '../../../../agent-kind';
import { useAgentRowWork } from '../../../../hooks/useAgentRowWork';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { agentRanModels, modelsSummary } from '../../../../timeline/ranModels';
import { RowIdentityCard } from './RowIdentityCard';
import { RowModelsCard } from './RowModelsCard';
import { TimelineModelCell } from './TimelineModelCell';
import { TimelineRowMeta } from './TimelineRowMeta';
import type { TimelineRowIdentity } from './timelineRowIdentity';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import type { TimelineLaneControl, TimelineLaneTarget } from './TimelineRail';
import {
  TimelineStreamRow,
  type TimelineBranchKey,
  type TimelineRowAction,
} from './TimelineStreamRow';

type Props = {
  readonly item: TimelineRowItem;
  readonly entry: TimelineAgentEntry;
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly sessionId: SessionId;
  readonly openTarget: TimelineOpenTarget | null;
  readonly action: TimelineRowAction | null;
  readonly diffStat: MountDiffStat | null;
  readonly worktrees: ReadonlyArray<string>;
  readonly runLane: TimelineLaneTarget | null;
  readonly step: Step | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly costUsd: number;
  readonly lanes: TimelineLaneControl | null;
  readonly onBranchKey: TimelineBranchKey | null;
};

const NO_SPANS: ReadonlyArray<MeasuredTurnSpan> = [];

export const TimelineAgentStreamRow = ({
  item,
  entry,
  rail,
  railWidth,
  sessionId,
  openTarget,
  action,
  diffStat,
  worktrees,
  runLane,
  step,
  roleModels,
  sessionProvider,
  sessionEffort,
  costUsd,
  lanes,
  onBranchKey,
}: Props) => {
  const contextMenu = useObjectMenuTrigger({
    target: { kind: 'agent', sessionId, agentId: entry.agent.id },
    anchorKey: `activity:${item.id}`,
  });
  const work = useAgentRowWork({
    agent: entry.agent,
    kind: entry.agentKind,
    step,
    roleModels,
    sessionProvider,
    sessionEffort,
    phase: item.rowState.phase,
  });
  const source = useContext(WorkTimeContext);
  const spans = source?.spans ?? NO_SPANS;
  const { provider, model, effort, isPlanned } = work.routing;
  const isLive = item.rowState.phase === 'running';
  const models = useMemo(
    () =>
      agentRanModels({
        spans,
        agentId: entry.agent.id,
        routing: { provider, model, effort },
        isRoutingPlanned: isPlanned,
        isLive,
      }),
    [spans, entry.agent.id, provider, model, effort, isPlanned, isLive],
  );
  const summary = modelsSummary({ models: models.models });
  const kindWord = agentKindPalette({ kind: entry.agentKind }).label;
  const last = models.models[models.models.length - 1] ?? null;
  const hasRole = !(
    entry.agent.parentAgentId == null &&
    entry.agent.stepId != null &&
    step?.role == null &&
    entry.agentKind === 'generic'
  );
  const identity: TimelineRowIdentity = {
    hasGlyph: hasRole,
    summary: hasRole
      ? [kindWord, last?.name, last?.effort].filter((part) => part != null).join(', ')
      : null,
    card: (
      <RowIdentityCard
        entry={entry}
        ordinal={item.ordinal}
        kindWord={kindWord}
        models={models}
        work={work}
        phase={item.rowState.phase}
        costUsd={costUsd}
      />
    ),
  };
  const cost = costUsd > 0 ? formatUsd(costUsd) : null;
  return (
    <TimelineStreamRow
      contextMenu={contextMenu}
      item={item}
      rail={rail}
      railWidth={railWidth}
      sessionId={sessionId}
      openTarget={openTarget}
      action={action}
      diffStat={diffStat}
      worktrees={worktrees}
      identity={identity}
      meta={
        <TimelineRowMeta
          model={
            <TimelineModelCell
              summary={summary}
              isPlanned={models.isPlanned}
              card={
                summary === null ? null : (
                  <RowModelsCard
                    entry={entry}
                    ordinal={item.ordinal}
                    kindWord={kindWord}
                    models={models}
                  />
                )
              }
            />
          }
          time={work.time ?? null}
          cost={cost}
          isPlanned={isPlanned}
        />
      }
      state={
        <TimelineRowStateLine
          state={item.rowState}
          note={item.rowState.phase === 'running' ? (work.time?.note ?? null) : null}
        />
      }
      progress={work.time?.progress ?? null}
      runLane={runLane}
      lanes={lanes}
      onBranchKey={onBranchKey}
    />
  );
};
