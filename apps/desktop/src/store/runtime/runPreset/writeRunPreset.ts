import {
  getWorkspaceValue,
  insertWorkspaceValueIfAbsent,
  replaceWorkspaceValueIfUnchanged,
  type Database,
} from '@goodboy/db';
import type { AgentId, RunPreset, WorkspaceId } from '@goodboy/types';
import { parseRunPresets } from './parseRunPresets';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly agentId: AgentId;
  readonly preset: RunPreset;
};

const MAX_ATTEMPTS = 3;

export const writeRunPreset = async ({
  db,
  workspaceId,
  agentId,
  preset,
}: Params): Promise<void> => {
  const key = 'run.preset';
  const next = JSON.stringify(preset);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const raw = await getWorkspaceValue({ db, workspaceId, key });
    const current = parseRunPresets({ raw });
    const stored = current.agents[agentId];
    if (stored !== undefined && JSON.stringify(stored) === next) {
      return;
    }
    const value = JSON.stringify({ agents: { ...current.agents, [agentId]: preset } });
    const isWritten =
      raw === null
        ? await insertWorkspaceValueIfAbsent({ db, workspaceId, key, value })
        : await replaceWorkspaceValueIfUnchanged({ db, workspaceId, key, expected: raw, value });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The preset changed in another window. Start the run again.');
};
