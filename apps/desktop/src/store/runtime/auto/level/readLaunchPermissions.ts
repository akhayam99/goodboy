import type { LaunchGuardRows } from '@goodboy/core/auto';
import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { readLeadPermissions } from './readLeadPermissions';

const ASK_BOTH: LaunchGuardRows = { dependencies: 'ask', protectedFiles: 'ask' };

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

const readRows = async ({ db, treeId }: Params): Promise<LaunchGuardRows> => {
  const { rows } = await readLeadPermissions({ db, target: { treeId } });
  return { dependencies: rows.dependencies.value, protectedFiles: rows.protectedFiles.value };
};

export const readLaunchPermissions = ({ db, treeId }: Params): Promise<LaunchGuardRows> =>
  readRows({ db, treeId }).catch((): LaunchGuardRows => ASK_BOTH);
