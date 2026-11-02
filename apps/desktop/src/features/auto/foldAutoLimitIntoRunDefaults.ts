import type { Database } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { readAutoTreeLimit, writeAutoTreeLimit } from './autoTreeLimit';

type SaveParams = {
  readonly usd: number;
};

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly runLimitUsd: number | null;
  readonly saveRunLimit: (params: SaveParams) => Promise<void>;
};

export const foldAutoLimitIntoRunDefaults = async ({
  db,
  workspaceId,
  runLimitUsd,
  saveRunLimit,
}: Params): Promise<boolean> => {
  const legacyUsd = await readAutoTreeLimit({ db, workspaceId });
  if (legacyUsd === null) {
    return false;
  }
  const usd = runLimitUsd === null ? legacyUsd : Math.min(runLimitUsd, legacyUsd);
  await saveRunLimit({ usd });
  await writeAutoTreeLimit({ db, workspaceId, usd: null });
  return true;
};
