import { getWorkspaceValue, type Database } from '@goodboy/db';
import type { AgentId, WorkspaceId } from '@goodboy/types';
import { parseRunLimit } from './parseRunLimit';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly agentId: AgentId;
};

export const readRunLimit = async ({
  db,
  workspaceId,
  agentId,
}: Params): Promise<number | null> => {
  const raw = await getWorkspaceValue({ db, workspaceId, key: 'run.limit' });
  return parseRunLimit({ raw }).agents[agentId] ?? null;
};
