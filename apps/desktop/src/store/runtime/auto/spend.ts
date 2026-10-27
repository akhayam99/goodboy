import { readAutoTreeSpend, type AutoTreeSpend, type Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';

type TreeSpendParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const treeSpend = ({ db, treeId }: TreeSpendParams): Promise<AutoTreeSpend | null> =>
  readAutoTreeSpend({ db, treeId });
