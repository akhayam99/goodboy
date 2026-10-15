import type { ProviderId, Session, SessionId, WorkflowRunId } from '@goodboy/types';
import { sessionById } from '../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null | undefined;
  readonly workspacePool?: ReadonlyArray<ProviderId> | null;
};

export const runProviderPool = ({
  sessions,
  sessionId,
  workflowRunId,
  workspacePool = null,
}: Params): ReadonlyArray<ProviderId> | null => {
  if (workflowRunId == null) {
    return workspacePool;
  }
  const session = sessionById(sessions, sessionId);
  const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
  return run?.providerPool ?? workspacePool;
};
