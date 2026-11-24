import { getTurnRoleInsight, type TurnRoleInsight } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sinceMs: number | null;
};

export const readTurnRoleInsight = ({ workspaceId, sinceMs }: Params): Promise<TurnRoleInsight> =>
  getTurnRoleInsight({ db: tauriDatabase, workspaceId, sinceMs });
