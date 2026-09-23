import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { cancelRunningSteps } from './cancelRunningSteps';
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
  await cancelRunningSteps({ set, get, sessionId, workflowRunId });
};

export const stopWorkflowRunNow = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    try {
      await runStop({ set, get, sessionId, workflowRunId });
    } catch (error) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: 'the run was not fully stopped',
        body: formatError(error),
        sessionId,
      });
    }
  };
};
