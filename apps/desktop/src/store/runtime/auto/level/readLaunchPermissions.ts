import type { LaunchGuardRows } from '@goodboy/core/auto';
import { getSetting, type Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { SETTING_WORK_ENABLED } from '../../../../shared/lib/workSetting';
import { readLeadPermissions } from './readLeadPermissions';

const ASK_BOTH: LaunchGuardRows = { dependencies: 'ask', protectedFiles: 'ask' };

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

const readRows = async ({ db, treeId }: Params): Promise<LaunchGuardRows> => {
  const isWorkFlowOn = (await getSetting(db, SETTING_WORK_ENABLED)) === 'true';
  const { rows } = await readLeadPermissions({ db, target: { treeId }, isWorkFlowOn });
  return { dependencies: rows.dependencies.value, protectedFiles: rows.protectedFiles.value };
};

export const readLaunchPermissions = ({ db, treeId }: Params): Promise<LaunchGuardRows> =>
  readRows({ db, treeId }).catch((): LaunchGuardRows => ASK_BOTH);
