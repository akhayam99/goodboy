import { storedLaunchGuardOf, type ChangeRules } from '@goodboy/core/auto';
import type { AutoAttempt, Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { readLaunchPermissions } from '../level/readLaunchPermissions';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly attempt: AutoAttempt | null;
};

export const readChangeRules = async ({ db, treeId, attempt }: Params): Promise<ChangeRules> => ({
  rows: await readLaunchPermissions({ db, treeId }),
  guard: attempt === null ? null : storedLaunchGuardOf({ writeSet: attempt.writeSet }),
});
