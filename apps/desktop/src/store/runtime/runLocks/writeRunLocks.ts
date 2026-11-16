import {
  getWorkspaceValue,
  insertWorkspaceValueIfAbsent,
  replaceWorkspaceValueIfUnchanged,
  type Database,
} from '@goodboy/db';
import type { AgentId, WorkspaceId } from '@goodboy/types';
import { parseRunLocks, type RunStepLock } from './parseRunLocks';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly agentId: AgentId;
  readonly locks: ReadonlyArray<RunStepLock>;
};

const MAX_ATTEMPTS = 3;

export const writeRunLocks = async ({ db, workspaceId, agentId, locks }: Params): Promise<void> => {
  const key = 'run.locks';
  const next = JSON.stringify(locks);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const raw = await getWorkspaceValue({ db, workspaceId, key });
    const current = parseRunLocks({ raw });
    const stored = current.agents[agentId];
    if (stored !== undefined && JSON.stringify(stored) === next) {
      return;
    }
    const value = JSON.stringify({ agents: { ...current.agents, [agentId]: locks } });
    const isWritten =
      raw === null
        ? await insertWorkspaceValueIfAbsent({ db, workspaceId, key, value })
        : await replaceWorkspaceValueIfUnchanged({ db, workspaceId, key, expected: raw, value });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The pinned models changed in another window. Start the run again.');
};
