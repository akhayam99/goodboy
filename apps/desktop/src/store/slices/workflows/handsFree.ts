import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { GetFn } from './types';

export const isHandsFree = (
  get: GetFn,
  sessionId: SessionId,
  workflowRunId?: WorkflowRunId | null | undefined,
): boolean => {
  const session = get().sessions.find((s) => s.id === sessionId);
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
