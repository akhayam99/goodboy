import { getSetting, type Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { SETTING_WORK_ENABLED } from '../../../../shared/lib/workSetting';
import { readLeadPermissions } from './readLeadPermissions';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readIsLeadClosing = async ({ db, treeId }: Params): Promise<boolean> => {
  const isWorkOn = (await getSetting(db, SETTING_WORK_ENABLED)) === 'true';
  if (!isWorkOn) {
    return false;
  }
  const permissions = await readLeadPermissions({
    db,
    target: { treeId },
    isWorkFlowOn: true,
  });
  return permissions.rows.closeWork.value === 'lead';
};
