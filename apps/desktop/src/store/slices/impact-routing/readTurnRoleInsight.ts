import type { TurnRoleInsight } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sinceMs: number | null;
};

export const readTurnRoleInsight = async ({
  workspaceId,
  sinceMs,
}: Params): Promise<TurnRoleInsight> => {
  const { getTurnRoleInsight } = await import('@goodboy/db/turn-role-insight');
  return getTurnRoleInsight({ db: tauriDatabase, workspaceId, sinceMs });
};
