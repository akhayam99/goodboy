import { autoBudgetFacts } from '@goodboy/core';
import {
  listAutoArtifactLedger,
  listAutoDelegations,
  listAutoTreesOfSession,
  readAutoTreeSpend,
  type Database,
} from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import type { AutoTreeView } from './state';

type Params = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const readAutoTreeViews = async ({
  db,
  sessionId,
}: Params): Promise<ReadonlyArray<AutoTreeView>> => {
  const trees = await listAutoTreesOfSession({ db, sessionId });
  return Promise.all(
    trees.map(async (tree): Promise<AutoTreeView> => {
      const [delegations, artifacts, spend] = await Promise.all([
        listAutoDelegations({ db, treeId: tree.id }),
        listAutoArtifactLedger({ db, treeId: tree.id }),
        readAutoTreeSpend({ db, treeId: tree.id }),
      ]);
      return {
        tree,
        delegations,
        artifacts,
        budget: spend === null ? null : autoBudgetFacts({ spend }),
      };
    }),
  );
};
