import { updateWorkflowRunRulesSnapshot } from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  type SessionId,
  type WorkflowAutonomy,
  type WorkflowRunId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { findWorkflowRun } from './findWorkflowRun';
import { persistOrchestrationStop } from './orchestrateNextStep';
import { patchWorkflowRun } from './patchWorkflowRun';
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
    const rulesSnapshot = {
      ...(run.rulesSnapshot ?? { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: false }),
      autonomy,
    };
    await updateWorkflowRunRulesSnapshot({ db: tauriDatabase, workflowRunId, rulesSnapshot });
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) => ({ ...current, rulesSnapshot }),
    });
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
