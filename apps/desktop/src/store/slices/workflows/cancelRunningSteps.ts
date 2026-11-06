import type { Agent, IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core/workflows';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { clearAgentStopping, markAgentStopping } from '../turn/stoppingAgents';
import type { GetFn, SetFn } from './types';

export type CutStepStatus = 'stopped' | 'skipped';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly cut: CutStepStatus;
};

export type CancelRunningStepsResult = Readonly<{
  stillRunning: ReadonlyArray<Agent>;
}>;

const NONE_RUNNING: CancelRunningStepsResult = { stillRunning: [] };

type MarkParams = Readonly<{
  agent: Agent;
  cut: CutStepStatus;
}>;

const markCut = async ({ agent, cut }: MarkParams): Promise<void> => {
  const at = new Date().toISOString() as IsoDateTime;
  if (cut === 'stopped') {
    await invokeAgentUpdateStatus(agent.id, { status: 'stopped', stoppedAt: at, stoppedBy: 'you' });
    return;
  }
  await invokeAgentUpdateStatus(agent.id, { status: 'skipped', completedAt: at });
};

export const cancelRunningSteps = async ({
  set,
  get,
  sessionId,
  workflowRunId,
  cut,
}: Params): Promise<CancelRunningStepsResult> => {
  const running = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId).filter(
    (agent) => agent.status === 'running',
  );
  if (running.length === 0) {
    return NONE_RUNNING;
  }
  const stillRunning: Agent[] = [];
  for (const agent of running) {
    markAgentStopping({ agentId: agent.id });
  }
  try {
    for (const agent of running) {
      const { outcome } = await get().cancelTurnConfirmed({
        sessionId,
        agentId: agent.id,
        reason: 'teardown',
      });
      if (outcome !== 'exited') {
        stillRunning.push(agent);
        continue;
      }
      await markCut({ agent, cut });
    }
    const refreshed = await invokeAgentList(sessionId);
    set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed } }));
  } finally {
    for (const agent of running) {
      clearAgentStopping({ agentId: agent.id });
    }
  }
  void get().refreshUnreadWorkspaces();
  return { stillRunning };
};
