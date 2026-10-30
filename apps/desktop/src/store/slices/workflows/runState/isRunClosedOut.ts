import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { sessionById } from '../../sessions/sessionIndex';
import type { GetFn } from '../types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const isRunClosedOut = ({ get, sessionId, workflowRunId }: Params): boolean => {
  const current = sessionById(get().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === workflowRunId,
  );
  return current == null || current.discardedAt != null || current.orchestrationOutcome != null;
};
