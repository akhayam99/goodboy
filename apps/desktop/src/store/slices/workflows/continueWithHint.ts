import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { OrchestratorHintDraft } from './addWorkflowOrchestratorHint';
import { clearOrchestrationOutcome } from './clearOrchestrationOutcome';
import { findWorkflowRun } from './findWorkflowRun';
import type { GetFn, SetFn } from './types';

export type ContinueHintDraft = Omit<OrchestratorHintDraft, 'delivery'>;

export const continueWithHint = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    draft: ContinueHintDraft,
  ): Promise<void> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run == null || run.executionMode !== 'dynamic' || run.discardedAt != null) {
      return;
    }
    const hint = await get().addWorkflowOrchestratorHint(sessionId, workflowRunId, {
      ...draft,
      delivery: 'queue',
    });
    const isStillDone =
      findWorkflowRun({ get, sessionId, workflowRunId })?.orchestrationOutcome === 'done';
    if (hint === null || !isStillDone) {
      return;
    }
    try {
      await clearOrchestrationOutcome({ set, sessionId, workflowRunId });
    } catch (error) {
      await get().removeWorkflowOrchestratorHint(sessionId, workflowRunId, hint.id);
      throw error;
    }
    void get().orchestrateNextStep(sessionId, workflowRunId);
  };
};
