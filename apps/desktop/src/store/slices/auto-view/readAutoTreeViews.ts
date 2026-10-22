import { autoBudgetOf, isRefusalPayload } from '@goodboy/core';
import {
  listAutoArtifactLedger,
  listAutoDelegations,
  listAutoOutbox,
  listAutoTreesOfSession,
  listGoneAutoChildIds,
  readAutoTreeSpend,
  readFirstUserText,
  type AutoOutboxRow,
  type AutoTree,
  type Database,
} from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { deliveredResultsOf } from './deliveredResultsOf';
import { presentDelegationsOf } from './presentDelegationsOf';
import type { AutoPendingRefusal, AutoTreeView } from './state';

type Params = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

type PendingRefusalParams = {
  readonly tree: AutoTree;
  readonly pending: ReadonlyArray<AutoOutboxRow>;
};

const pendingRefusalOf = ({ tree, pending }: PendingRefusalParams): AutoPendingRefusal | null => {
  const latest = pending
    .filter((row) => row.kind === 'refusal' && row.generation === tree.generation)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (latest === undefined || !isRefusalPayload(latest.payload)) {
    return null;
  }
  const roles = latest.payload.roles ?? [];
  return {
    action: latest.payload.action,
    code: latest.payload.code,
    roles: roles.filter((role) => typeof role === 'string'),
  };
};

export const readAutoTreeViews = async ({
  db,
  sessionId,
}: Params): Promise<ReadonlyArray<AutoTreeView>> => {
  const trees = await listAutoTreesOfSession({ db, sessionId });
  return Promise.all(
    trees.map(async (tree): Promise<AutoTreeView> => {
      const [delegations, goneChildIds, artifacts, spend, pending, accepted, rootAsk] =
        await Promise.all([
          listAutoDelegations({ db, treeId: tree.id }),
          listGoneAutoChildIds({ db, treeId: tree.id, sessionId }),
          listAutoArtifactLedger({ db, treeId: tree.id }),
          readAutoTreeSpend({ db, treeId: tree.id }),
          listAutoOutbox({ db, treeId: tree.id, states: ['pending'] }),
          listAutoOutbox({ db, treeId: tree.id, states: ['accepted'], kinds: ['results'] }),
          readFirstUserText({ db, agentId: tree.rootAgentId }),
        ]);
      return {
        tree,
        delegations: presentDelegationsOf({ delegations, goneChildIds: new Set(goneChildIds) }),
        artifacts,
        budget: spend === null ? null : autoBudgetOf({ spend }),
        pendingRefusal: pendingRefusalOf({ tree, pending }),
        deliveredResults: deliveredResultsOf({ accepted }),
        rootAsk,
      };
    }),
  );
};
