import { updateWorkflowRunRulesSnapshot } from '@goodboy/db';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { findWorkflowRun } from './findWorkflowRun';
import { persistOrchestrationStop } from './orchestrateNextStep';
import { patchWorkflowRun } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';
import { isRunHeldForPlan } from './workflowPlanApproval';

export const approveWorkflowRunPlan = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run == null || run.rulesSnapshot === undefined || !isRunHeldForPlan({ run })) {
      return;
    }
    const rulesSnapshot = { ...run.rulesSnapshot, planApproved: true };
    await updateWorkflowRunRulesSnapshot({ db: tauriDatabase, workflowRunId, rulesSnapshot });
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) => ({ ...current, rulesSnapshot }),
    });
    await persistOrchestrationStop({ set, sessionId, workflowRunId, stop: null });
    void get().maybeAutoAdvanceWorkflow(sessionId);
  };
};
