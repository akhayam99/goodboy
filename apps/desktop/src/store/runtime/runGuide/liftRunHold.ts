import { continuedGuide } from '@goodboy/core/auto';
import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { changeRunGuide } from './changeRunGuide';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const liftRunHold = async ({ db, treeId }: Params): Promise<void> => {
  await changeRunGuide({ db, treeId, change: continuedGuide });
};
