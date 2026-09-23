import type { IsoDateTime, OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { findWorkflowRun } from './findWorkflowRun';
import type { GetFn, SetFn } from './types';
import { writeOrchestratorHints } from './writeOrchestratorHints';

export type OrchestratorHintDraft = {
  readonly text: string;
};

export const addWorkflowOrchestratorHint = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    draft: OrchestratorHintDraft,
  ) => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    const text = draft.text.trim();
    if (run == null || text === '') {
      return;
    }
    const hint: OrchestratorHint = {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString() as IsoDateTime,
    };
    await writeOrchestratorHints({
      set,
      sessionId,
      workflowRunId,
      hints: [...(run.orchestratorHints ?? []), hint],
    });
    if (get().orchestratingWorkflowRuns[workflowRunId] === true) {
      void get().orchestrateNextStep(sessionId, workflowRunId);
    }
  };
};
