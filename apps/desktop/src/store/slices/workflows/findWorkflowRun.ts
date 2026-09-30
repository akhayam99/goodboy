import type { SessionId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const findWorkflowRun = ({ get, sessionId, workflowRunId }: Params): WorkflowRun | null =>
  sessionById(get().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === workflowRunId,
  ) ?? null;
