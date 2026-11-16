import type { AdmissionPermissions } from '@goodboy/core/auto';
import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { readLeadPermissions } from '../level/readLeadPermissions';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readAdmissionPermissions = async ({
  db,
  treeId,
}: Params): Promise<AdmissionPermissions> => {
  const { rows } = await readLeadPermissions({ db, target: { treeId } });
  return {
    approvePlan: rows.approvePlan.value,
    startReaders: rows.startReaders.value,
    startWriters: rows.startWriters.value,
    addProject: rows.addProject.value,
  };
};
