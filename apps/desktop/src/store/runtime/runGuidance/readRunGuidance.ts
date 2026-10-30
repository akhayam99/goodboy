import { getWorkspaceValue, type Database } from '@goodboy/db';
import type { AgentId, WorkspaceId } from '@goodboy/types';
import { parseRunGuidance } from './parseRunGuidance';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly agentId: AgentId;
};

export const readRunGuidance = async ({
  db,
  workspaceId,
  agentId,
}: Params): Promise<string | null> => {
  const raw = await getWorkspaceValue({ db, workspaceId, key: 'run.guidance' });
  const text = parseRunGuidance({ raw }).agents[agentId]?.trim() ?? '';
  return text === '' ? null : text;
};
