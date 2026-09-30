import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

export const isHandsFree = (
  get: GetFn,
  sessionId: SessionId,
  workflowRunId?: WorkflowRunId | null | undefined,
): boolean => {
  const session = sessionById(get().sessions, sessionId);
  if (!session) {
    return false;
  }
  if (workflowRunId != null) {
    const run = session.workflowRuns.find((r) => r.id === workflowRunId);
    if (run) {
      return run.autoRun;
    }
  }
  return session.autoRun;
};
