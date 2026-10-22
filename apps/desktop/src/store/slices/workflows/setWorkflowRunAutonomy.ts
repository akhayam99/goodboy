import type { SessionId, WorkflowAutonomy, WorkflowRunId } from '@goodboy/types';
import { findWorkflowRun } from './findWorkflowRun';
import { persistOrchestrationStop } from './orchestrateNextStep';
import type { GetFn, SetFn } from './types';
import { isRunHeldForPlan } from './workflowPlanApproval';

export const setWorkflowRunAutonomy = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    autonomy: WorkflowAutonomy,
  ): Promise<void> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run == null) {
      return;
    }
    await get().updateWorkflowRunRules(sessionId, workflowRunId, (rules) => ({
      ...rules,
      autonomy,
    }));
    if (autonomy !== 'plan' && isRunHeldForPlan({ run })) {
      await persistOrchestrationStop({ set, sessionId, workflowRunId, stop: null });
    }
    const autoRun = autonomy !== 'step';
    if (autoRun === run.autoRun && !isRunHeldForPlan({ run })) {
      return;
    }
    await get().setWorkflowRunAutoRun(sessionId, workflowRunId, autoRun);
  };
};
