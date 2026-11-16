import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { readLeadPermissions } from './readLeadPermissions';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readIsLeadClosing = async ({ db, treeId }: Params): Promise<boolean> => {
  const permissions = await readLeadPermissions({ db, target: { treeId } });
  return permissions.rows.closeWork.value === 'lead';
};
