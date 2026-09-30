import type { ProviderId, Session, SessionId, WorkflowRunId } from '@goodboy/types';
import { sessionById } from '../../store/slices/sessions/sessionIndex';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null | undefined;
};

export const runProviderPool = ({
  sessions,
  sessionId,
  workflowRunId,
}: Params): ReadonlyArray<ProviderId> | null => {
  if (workflowRunId == null) {
    return null;
  }
  const session = sessionById(sessions, sessionId);
  const run = session?.workflowRuns.find((candidate) => candidate.id === workflowRunId);
  return run?.providerPool ?? null;
};
