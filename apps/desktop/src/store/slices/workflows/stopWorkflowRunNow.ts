import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { runsForWorkflowRun } from '@goodboy/core';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { persistOrchestrationStop } from './orchestrateNextStep';
import type { GetFn, SetFn } from './types';

const OPERATOR_STOP_MESSAGE =
  'You stopped this run. The step in flight was skipped and everything it had already written is kept.';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

const runStop = async ({ set, get, sessionId, workflowRunId }: Params): Promise<void> => {
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
  if (run == null || run.discardedAt != null) {
    return;
  }
  await persistOrchestrationStop({
    set,
    sessionId,
    workflowRunId,
    stop: { kind: 'operator', message: OPERATOR_STOP_MESSAGE },
  });
  await get().setWorkflowRunAutoRun(sessionId, workflowRunId, false);
  const running = runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId).filter(
    (agent) => agent.status === 'running',
  );
  if (running.length === 0) {
    return;
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
};

export const stopWorkflowRunNow = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    try {
      await runStop({ set, get, sessionId, workflowRunId });
    } catch (error) {
      void get().emitNotification(
        'error',
        'warning',
        'the run was not fully stopped',
        formatError(error),
        { sessionId },
      );
    }
  };
};
