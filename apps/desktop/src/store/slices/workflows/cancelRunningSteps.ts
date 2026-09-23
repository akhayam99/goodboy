import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const cancelRunningSteps = async ({
  set,
  get,
  sessionId,
  workflowRunId,
}: Params): Promise<boolean> => {
  const running = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId).filter(
    (agent) => agent.status === 'running',
  );
  if (running.length === 0) {
    return false;
  }
  for (const agent of running) {
    await get().cancelCurrentTurn(sessionId, agent.id);
    await invokeAgentUpdateStatus(agent.id, {
      status: 'skipped',
      completedAt: new Date().toISOString() as IsoDateTime,
    });
  }
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed } }));
  void get().refreshUnreadWorkspaces();
  return true;
};
