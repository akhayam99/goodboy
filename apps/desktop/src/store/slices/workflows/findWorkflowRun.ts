import type { SessionId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const findWorkflowRun = ({ get, sessionId, workflowRunId }: Params): WorkflowRun | null =>
  get()
    .sessions.find((candidate) => candidate.id === sessionId)
    ?.workflowRuns.find((candidate) => candidate.id === workflowRunId) ?? null;
