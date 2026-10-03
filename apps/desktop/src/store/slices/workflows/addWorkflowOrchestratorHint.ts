import type {
  AttachmentInput,
  IsoDateTime,
  OrchestratorHint,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { runsForWorkflowRun } from '@goodboy/core';
import { saveGoalAttachments } from '../attachments/saveGoalAttachments';
import { cancelRunningSteps } from './cancelRunningSteps';
import { requestDecisionRestart } from './decisionRestart';
import { findWorkflowRun } from './findWorkflowRun';
import { isRunPaused } from '../../../features/workflows/isRunPaused';
import { markHintsReading, releaseHintsReading } from './orchestratorReadingHints';
import type { GetFn, SetFn } from './types';
import { updateOrchestratorHints } from './updateOrchestratorHints';

export type OrchestratorHintDelivery = 'queue' | 'now';

export type OrchestratorHintDraft = {
  readonly text: string;
  readonly delivery: OrchestratorHintDelivery;
  readonly attachments?: ReadonlyArray<AttachmentInput>;
};

const IMAGE_ONLY_HINT_TEXT = 'See the attached image.';

const NO_WORKTREE_FOR_HINT_FILES =
  'This session has no worktree yet, so the hint cannot keep files.';

type SaveFilesParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly inputs: ReadonlyArray<AttachmentInput>;
};

const saveHintFiles = async ({
  set,
  get,
  sessionId,
  workflowRunId,
  inputs,
}: SaveFilesParams): Promise<ReadonlyArray<string>> => {
  if (inputs.length === 0) {
    return [];
  }
  const worktreeDir = get().sessionWorktrees[sessionId]?.[0];
  if (worktreeDir === undefined) {
    throw new Error(NO_WORKTREE_FOR_HINT_FILES);
  }
  return saveGoalAttachments({
    set,
    worktreeDir,
    owner: { type: 'workflow_run', id: workflowRunId },
    inputs,
  });
};

type DeliverParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

type ReadNowParams = DeliverParams & {
  readonly hintId: string;
};

const deliverNow = async ({ set, get, sessionId, workflowRunId }: DeliverParams): Promise<void> => {
  if (get().orchestratingWorkflowRuns[workflowRunId] === true) {
    requestDecisionRestart({ set, workflowRunId });
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

const readNow = async ({ set, get, sessionId, workflowRunId, hintId }: ReadNowParams) => {
  markHintsReading({ set, workflowRunId, hintIds: [hintId] });
  try {
    await deliverNow({ set, get, sessionId, workflowRunId });
  } finally {
    const isDecisionAhead =
      get().orchestratingWorkflowRuns[workflowRunId] === true ||
      get().pendingOrchestrations[workflowRunId] != null;
    if (isDecisionAhead === false) {
      releaseHintsReading({ set, workflowRunId, hintIds: [hintId] });
    }
  }
};

export const addWorkflowOrchestratorHint = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    draft: OrchestratorHintDraft,
  ) => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    const inputs = draft.attachments ?? [];
    const typed = draft.text.trim();
    if (run == null || (typed === '' && inputs.length === 0)) {
      return;
    }
    const attachmentIds = await saveHintFiles({ set, get, sessionId, workflowRunId, inputs });
    const hint: OrchestratorHint = {
      id: crypto.randomUUID(),
      text: typed === '' ? IMAGE_ONLY_HINT_TEXT : typed,
      createdAt: new Date().toISOString() as IsoDateTime,
      ...(attachmentIds.length > 0 && { attachmentIds }),
    };
    await updateOrchestratorHints({
      set,
      get,
      sessionId,
      workflowRunId,
      update: (hints) => [...hints, hint],
    });
    const current = findWorkflowRun({ get, sessionId, workflowRunId });
    if (
      draft.delivery === 'queue' ||
      run.executionMode !== 'dynamic' ||
      run.discardedAt != null ||
      isRunPaused({ run: current })
    ) {
      return;
    }
    void readNow({ set, get, sessionId, workflowRunId, hintId: hint.id });
  };
};
