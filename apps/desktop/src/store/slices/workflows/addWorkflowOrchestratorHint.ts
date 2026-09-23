import type { IsoDateTime, OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { cancelRunningSteps } from './cancelRunningSteps';
import { requestDecisionRestart } from './decisionRestart';
import { findWorkflowRun } from './findWorkflowRun';
import type { GetFn, SetFn } from './types';
import { writeOrchestratorHints } from './writeOrchestratorHints';

export type OrchestratorHintDelivery = 'queue' | 'now';

export type OrchestratorHintDraft = {
  readonly text: string;
  readonly delivery: OrchestratorHintDelivery;
};

type DeliverParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

const deliverNow = async ({ set, get, sessionId, workflowRunId }: DeliverParams): Promise<void> => {
  if (get().orchestratingWorkflowRuns[workflowRunId] === true) {
    requestDecisionRestart({ workflowRunId });
    await get().orchestrateNextStep(sessionId, workflowRunId);
    return;
  }
  const hasRunningStep = runsForWorkflowRun(
    get().sessionPhaseRuns[sessionId] ?? [],
    workflowRunId,
  ).some((agent) => agent.status === 'running');
  if (hasRunningStep) {
    await cancelRunningSteps({ set, get, sessionId, workflowRunId });
  }
  await get().continueWorkflowRun(sessionId, workflowRunId);
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
    if (draft.delivery === 'queue' || run.executionMode !== 'dynamic' || run.discardedAt != null) {
      return;
    }
    await deliverNow({ set, get, sessionId, workflowRunId });
  };
};
