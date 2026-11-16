import { getWorkspaceValue, type Database } from '@goodboy/db';
import type { AgentId, WorkflowRoutingLock, WorkspaceId } from '@goodboy/types';
import { parseRunLocks } from './parseRunLocks';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly agentId: AgentId;
  readonly role: string;
};

export const readRunStepLock = async ({
  db,
  workspaceId,
  agentId,
  role,
}: Params): Promise<WorkflowRoutingLock | null> => {
  const raw = await getWorkspaceValue({ db, workspaceId, key: 'run.locks' });
  const locks = parseRunLocks({ raw }).agents[agentId] ?? [];
  return locks.find((step) => step.role === role)?.routingLock ?? null;
};
