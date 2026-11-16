import {
  getWorkspaceValue,
  insertWorkspaceValueIfAbsent,
  replaceWorkspaceValueIfUnchanged,
  type Database,
} from '@goodboy/db';
import type { AgentId, WorkspaceId } from '@goodboy/types';
import { parseRunLimit } from './parseRunLimit';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly agentId: AgentId;
  readonly usd: number;
};

const MAX_ATTEMPTS = 3;

export const writeRunLimit = async ({ db, workspaceId, agentId, usd }: Params): Promise<void> => {
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error('A run limit must be more than $0.');
  }
  const key = 'run.limit';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const raw = await getWorkspaceValue({ db, workspaceId, key });
    const current = parseRunLimit({ raw });
    if (current.agents[agentId] === usd) {
      return;
    }
    const value = JSON.stringify({ agents: { ...current.agents, [agentId]: usd } });
    const isWritten =
      raw === null
        ? await insertWorkspaceValueIfAbsent({ db, workspaceId, key, value })
        : await replaceWorkspaceValueIfUnchanged({ db, workspaceId, key, expected: raw, value });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The limit changed in another window. Start the run again.');
};
