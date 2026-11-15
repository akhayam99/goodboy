import type { AdmissionPermissions } from '@goodboy/core/auto';
import { getSetting, type Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { SETTING_WORK_ENABLED } from '../../../../shared/lib/workSetting';
import { readLeadPermissions } from '../level/readLeadPermissions';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readAdmissionPermissions = async ({
  db,
  treeId,
}: Params): Promise<AdmissionPermissions> => {
  const isWorkFlowOn = (await getSetting(db, SETTING_WORK_ENABLED)) === 'true';
  const { rows } = await readLeadPermissions({ db, target: { treeId }, isWorkFlowOn });
  return {
    approvePlan: rows.approvePlan.value,
    startReaders: rows.startReaders.value,
    startWriters: rows.startWriters.value,
    addProject: rows.addProject.value,
  };
};
