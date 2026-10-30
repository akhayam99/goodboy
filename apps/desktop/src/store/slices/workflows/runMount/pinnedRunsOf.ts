import { isAgentStatusSettled } from '@goodboy/core';
import type { Agent, MountId, SessionId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import type { AppState } from '../../../types';
import { sessionById } from '../../sessions/sessionIndex';

type State = Pick<AppState, 'sessions' | 'sessionPhaseRuns'>;

type Params = Readonly<{
  state: State;
  sessionId: SessionId;
  mountId: MountId;
}>;

type RunParams = Readonly<{
  run: WorkflowRun;
  agents: ReadonlyArray<Agent>;
}>;

const isRunOpen = ({ run, agents }: RunParams): boolean => {
  if (run.discardedAt != null || run.orchestrationStop != null) {
    return false;
  }
  if (run.orchestrationOutcome === 'done') {
    return false;
  }
  return !(
    run.executionMode === 'static' &&
    agents.length > 0 &&
    agents.every((agent) => isAgentStatusSettled({ status: agent.status }))
  );
};

type LabelParams = Readonly<{
  run: WorkflowRun;
}>;

const runLabel = ({ run }: LabelParams): string => {
  const title = run.title?.trim() ?? '';
  if (title !== '') {
    return title;
  }
  const goal = run.goal?.trim() ?? '';
  return goal !== '' ? goal : `run ${run.ordinal + 1}`;
};

export type PinnedRun = Readonly<{
  runId: WorkflowRunId;
  label: string;
}>;

export const pinnedRunsOf = ({ state, sessionId, mountId }: Params): ReadonlyArray<PinnedRun> => {
  const agents = state.sessionPhaseRuns?.[sessionId] ?? [];
  const runs = sessionById(state.sessions, sessionId)?.workflowRuns ?? [];
  return runs.flatMap((run) => {
    const runAgents = agents.filter((agent) => agent.workflowRunId === run.id);
    const isPinned = runAgents.some((agent) => agent.mountId === mountId);
    return isPinned && isRunOpen({ run, agents: runAgents })
      ? [{ runId: run.id, label: runLabel({ run }) }]
      : [];
  });
};
