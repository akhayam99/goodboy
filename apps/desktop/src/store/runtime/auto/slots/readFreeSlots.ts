import { AUTO_MAX_RUNNING_CHILDREN, autoRemainingForGates } from '@goodboy/core/auto';
import {
  AUTO_USD_EPSILON,
  countAutoRunningChildren,
  readAutoTreeSpend,
  type Database,
} from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readFreeSlots = async ({ db, treeId }: Params): Promise<number> => {
  const spend = await readAutoTreeSpend({ db, treeId });
  if (autoRemainingForGates({ spend }) <= AUTO_USD_EPSILON) {
    return 0;
  }
  const running = await countAutoRunningChildren({ db, treeId });
  return Math.max(0, AUTO_MAX_RUNNING_CHILDREN - running);
};
