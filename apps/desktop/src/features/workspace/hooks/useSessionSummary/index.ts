import { useMemo } from 'react';
import type {
  Agent,
  PullRequestStateKind,
  Session,
  SessionAttentionReason,
  SessionExternalTask,
  SessionId,
  SessionStage,
} from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import {
  EMPTY_ARRAY,
  useAppStore,
  useNonResolverStandaloneAgents,
  useSessionCost,
  useSessionStageInfo,
} from '../../../../store';
import { describeSessionStage } from '../../../session/session-stage';
import { distinctTasks } from '../../../../shared/utils/distinctTasks';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { workflowProgress, type WorkflowProgress } from './workflowProgress';
import { useNow } from '../../../../shared/hooks/useNow';

export type SessionSummary = {
  readonly stage: SessionStage;
  readonly attention: SessionAttentionReason | null;
  readonly tone: Tone;
  readonly reason: string;
  readonly addsFact: boolean;
  readonly description: string;
  readonly prState: PullRequestStateKind | null;
  readonly progress: WorkflowProgress | null;
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly agentCount: number;
  readonly isAutorun: boolean;
  readonly cost: number;
  readonly age: string;
};

type Params = {
  readonly session: Session;
};

export const useSessionSummary = ({ session }: Params): SessionSummary => {
  const now = useNow(30_000);
  const id = session.id as SessionId;
  const stageInfo = useSessionStageInfo(session);
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[id] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const runs = useAttachedWorkflowRuns({ session });
  const linkedTasks = useAppStore(
    (s) => s.sessionExternalTasks[id] ?? (EMPTY_ARRAY as ReadonlyArray<SessionExternalTask>),
  );
  const tasks = useMemo(
    () => distinctTasks({ tasks: linkedTasks }).map((entry) => entry.task),
    [linkedTasks],
  );
  const agentCount = useNonResolverStandaloneAgents(id).length;
  const cost = useSessionCost(id);

  const progress = useMemo(() => workflowProgress({ runs, agents: phaseRuns }), [runs, phaseRuns]);

  const presentation = describeSessionStage(stageInfo);
  const isAutorun =
    stageInfo.stage === 'running' &&
    session.workflowRuns.some((run) => run.autoRun && run.discardedAt == null);

  return {
    stage: stageInfo.stage,
    attention: stageInfo.attention,
    tone: presentation.tone,
    reason: stageInfo.reason,
    addsFact: stageInfo.addsFact,
    description: stateDescription({ presentation }),
    prState: stageInfo.prState,
    progress,
    tasks,
    agentCount,
    isAutorun,
    cost,
    age: formatAge({ from: session.updatedAt, now }),
  };
};
