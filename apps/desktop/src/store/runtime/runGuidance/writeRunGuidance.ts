import {
  getWorkspaceValue,
  insertWorkspaceValueIfAbsent,
  replaceWorkspaceValueIfUnchanged,
  type Database,
} from '@goodboy/db';
import type { AgentId, WorkspaceId } from '@goodboy/types';
import { parseRunGuidance } from './parseRunGuidance';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly agentId: AgentId;
  readonly text: string;
};

const MAX_ATTEMPTS = 3;

export const writeRunGuidance = async ({
  db,
  workspaceId,
  agentId,
  text,
}: Params): Promise<void> => {
  const key = 'run.guidance';
  const guidance = text.trim();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const raw = await getWorkspaceValue({ db, workspaceId, key });
    const current = parseRunGuidance({ raw });
    if (current.agents[agentId] === guidance) {
      return;
    }
    const value = JSON.stringify({ agents: { ...current.agents, [agentId]: guidance } });
    const isWritten =
      raw === null
        ? await insertWorkspaceValueIfAbsent({ db, workspaceId, key, value })
        : await replaceWorkspaceValueIfUnchanged({ db, workspaceId, key, expected: raw, value });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The guidance changed in another window. Start the run again.');
};
