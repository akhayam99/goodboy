import type { ProviderId, ProviderPolicy, Session, SessionId, WorkflowRunId } from '@goodboy/types';
import { runProviderPool } from '../workflows/runProviderPool';
import { AUTO_CHILD_PROVIDERS } from './autoProviders';
import { workspaceProviderPool } from './workspaceProviderPool';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly policy: ProviderPolicy | null;
};

export const autoChildPool = ({
  sessions,
  sessionId,
  workflowRunId = null,
  policy,
}: Params): ReadonlyArray<ProviderId> => {
  const pool = runProviderPool({
    sessions,
    sessionId,
    workflowRunId,
    workspacePool: workspaceProviderPool({ policy }),
  });
  return pool === null
    ? AUTO_CHILD_PROVIDERS
    : AUTO_CHILD_PROVIDERS.filter((provider) => pool.includes(provider));
};
