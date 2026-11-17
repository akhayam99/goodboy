import type { ProviderId, ProviderPolicy, Session, SessionId, WorkflowRunId } from '@goodboy/types';
import { runProviderPool } from '../workflows/runProviderPool';
import { autoChildProviders, type AutoDelegationRole } from '@goodboy/core/auto';
import { workspaceProviderPool } from './workspaceProviderPool';

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly policy: ProviderPolicy | null;
  readonly role: AutoDelegationRole;
};

export const autoChildPool = ({
  sessions,
  sessionId,
  workflowRunId = null,
  policy,
  role,
}: Params): ReadonlyArray<ProviderId> => {
  const pool = runProviderPool({
    sessions,
    sessionId,
    workflowRunId,
    workspacePool: workspaceProviderPool({ policy }),
  });
  const allowed = autoChildProviders({ role });
  return pool === null ? allowed : allowed.filter((provider) => pool.includes(provider));
};
