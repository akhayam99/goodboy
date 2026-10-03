import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { isRunPaused } from '../../../features/workflows/isRunPaused';
import { findWorkflowRun } from './findWorkflowRun';
import { persistOrchestrationStop } from './orchestrateNextStep';
import type { GetFn, SetFn } from './types';

const RUN_PAUSE_MESSAGE =
  'Paused by you. The step in flight finishes its turn and nothing new starts until you resume.';

const ENDED_STOPS: ReadonlySet<string> = new Set(['operator', 'closed']);

export const pauseWorkflowRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run == null || run.discardedAt != null || isRunPaused({ run })) {
      return;
    }
    if (run.orchestrationStop != null && ENDED_STOPS.has(run.orchestrationStop.kind)) {
      return;
    }
    await persistOrchestrationStop({
      set,
      sessionId,
      workflowRunId,
      stop: { kind: 'paused', message: RUN_PAUSE_MESSAGE },
    });
  };
};
