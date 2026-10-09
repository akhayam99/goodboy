import { useObjectMenuTrigger } from '../../../../../actions/useObjectMenuTrigger';
import type {
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  Step,
} from '@goodboy/types';
import type { MountDiffStat } from '../../../../../../store';
import type { RailRow } from '../../../../../workTreeModel/railGeometry';
import { useAgentRowWork } from '../../../../hooks/useAgentRowWork';
import type { TimelineOpenTarget } from '../../../../hooks/useTimelineOpen';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';
import { AgentRowMeta } from './AgentRowMeta';
import { agentRowIdentity } from './AgentRowIdentity';
import { useAgentRowModels } from './useAgentRowModels';
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
  const rowModels = useAgentRowModels({ entry, work, phase: item.rowState.phase });
  const identity = agentRowIdentity({
    entry,
    ordinal: item.ordinal,
    step,
    work,
    rowModels,
    phase: item.rowState.phase,
    costUsd,
  });
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
        <AgentRowMeta
          entry={entry}
          ordinal={item.ordinal}
          work={work}
          rowModels={rowModels}
          costUsd={costUsd}
          isRunning={item.rowState.phase === 'running'}
        />
      }
      state={<TimelineRowStateLine state={item.rowState} />}
      progress={work.time?.progress ?? null}
      runLane={runLane}
      lanes={lanes}
      onBranchKey={onBranchKey}
    />
  );
};
