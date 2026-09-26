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
import { TimelineAgentMeta } from './TimelineAgentMeta';
import type { TimelineLaneControl, TimelineLaneTarget } from './TimelineRail';
import { TimelineStreamRow, type TimelineRowAction } from './TimelineStreamRow';

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
  readonly lanes: TimelineLaneControl | null;
  readonly runLane: TimelineLaneTarget | null;
  readonly step: Step | null;
  readonly roleModels: RoleModelPreferences | null;
  readonly sessionProvider: ProviderId | null;
  readonly sessionEffort: EffortLevel | null;
  readonly costUsd: number;
  readonly isRevealed?: boolean;
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
  lanes,
  runLane,
  step,
  roleModels,
  sessionProvider,
  sessionEffort,
  costUsd,
  isRevealed = false,
}: Props) => {
  const work = useAgentRowWork({
    agent: entry.agent,
    kind: entry.agentKind,
    step,
    roleModels,
    sessionProvider,
    sessionEffort,
    phase: item.rowState.phase,
  });
  return (
    <TimelineStreamRow
      item={item}
      rail={rail}
      railWidth={railWidth}
      sessionId={sessionId}
      openTarget={openTarget}
      action={action}
      diffStat={diffStat}
      worktrees={worktrees}
      meta={<TimelineAgentMeta work={work} costUsd={costUsd} />}
      progress={work.time?.progress ?? null}
      stateNote={work.time?.note ?? null}
      isRevealed={isRevealed}
      lanes={lanes}
      runLane={runLane}
    />
  );
};
