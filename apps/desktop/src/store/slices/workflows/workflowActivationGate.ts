import { listOpenQuestionsForSession } from '@goodboy/db';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { workflowRunHasOpenQuestions } from '../../../features/context/openQuestionsGate';
import { WORKFLOW_BLOCK_COPY } from '../../../features/workflows/blockCopy';
import type { WorkflowBlockReason } from '../../../features/workflows/advanceGate';

type ErrorParams = {
  readonly reason: WorkflowBlockReason;
};

export class WorkflowGateError extends Error {
  readonly reason: WorkflowBlockReason;

  constructor({ reason }: ErrorParams) {
    super(WORKFLOW_BLOCK_COPY[reason]);
    this.name = 'WorkflowGateError';
    this.reason = reason;
  }
}

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | undefined;
};

export const findWorkflowActivationBlock = async ({
  sessionId,
  workflowRunId,
}: Params): Promise<WorkflowBlockReason | null> => {
  if (workflowRunId == null) {
    return null;
  }
  const questions = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
  if (!workflowRunHasOpenQuestions(questions, workflowRunId)) {
    return null;
  }
  return 'questions';
};
