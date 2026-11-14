import {
  AUTO_WITHDRAWN_REASON,
  autoBudgetOf,
  isRefusalPayload,
  isUserPayload,
  mountNoteOf,
} from '@goodboy/core/auto';
import {
  listAutoArtifactLedger,
  listAutoDelegations,
  listAutoGrantsOfTree,
  listAutoLaunchSnapshotsOfTree,
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
import { readAutoLevel } from '../../runtime/auto/level/readAutoLevel';
import { userImagesOf } from '../../runtime/auto/userImagesOf';
import { deliveredResultsOf } from './deliveredResultsOf';
import { hiddenChildIdsOf } from './hiddenChildIdsOf';
import { presentDelegationsOf } from './presentDelegationsOf';
import { readMessagesOf } from './readMessagesOf';
import type { AutoPendingMessage, AutoPendingRefusal, AutoTreeView } from './state';

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
    .filter(
      (row) =>
        row.state === 'pending' && row.kind === 'refusal' && row.generation === tree.generation,
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (latest === undefined || !isRefusalPayload(latest.payload)) {
    return null;
  }
  const roles = latest.payload.roles ?? [];
  const mount = mountNoteOf({ value: latest.payload.mount });
  return {
    action: latest.payload.action,
    code: latest.payload.code,
    roles: roles.filter((role) => typeof role === 'string'),
    ...(mount === null ? {} : { mount }),
  };
};

type ShownMessageParams = {
  readonly tree: AutoTree;
  readonly row: AutoOutboxRow;
};

const isShownMessage = ({ tree, row }: ShownMessageParams): boolean => {
  if (row.state === 'pending') {
    return row.generation === tree.generation;
  }
  const isStopped = tree.phase === 'stopping' || tree.phase === 'stopped';
  return isStopped && row.state === 'dropped' && row.droppedReason === 'stopped';
};

const pendingMessagesOf = ({
  tree,
  pending,
}: PendingRefusalParams): ReadonlyArray<AutoPendingMessage> =>
  pending
    .filter((row) => row.kind === 'user' && isShownMessage({ tree, row }))
    .map((row) => ({
      rowId: String(row.id),
      createdAt: row.createdAt,
      text: isUserPayload(row.payload) ? row.payload.text : '',
      images: userImagesOf({ rows: [row] }),
    }));

const droppedMessageIdsOf = ({ tree, pending }: PendingRefusalParams): ReadonlyArray<string> =>
  pending
    .filter(
      (row) =>
        row.kind === 'user' &&
        row.state === 'dropped' &&
        row.droppedReason !== AUTO_WITHDRAWN_REASON &&
        !isShownMessage({ tree, row }),
    )
    .map((row) => String(row.id));

export const readAutoTreeViews = async ({
  db,
  sessionId,
}: Params): Promise<ReadonlyArray<AutoTreeView>> => {
  const trees = await listAutoTreesOfSession({ db, sessionId });
  if (trees.length === 0) {
    return [];
  }
  const level = await readAutoLevel({ db, target: { sessionId } });
  return Promise.all(
    trees.map(async (tree): Promise<AutoTreeView> => {
      const [
        delegations,
        goneChildIds,
        artifacts,
        spend,
        pending,
        accepted,
        rootAsk,
        grantAsks,
        snapshots,
      ] = await Promise.all([
        listAutoDelegations({ db, treeId: tree.id }),
        listGoneAutoChildIds({ db, treeId: tree.id, sessionId }),
        listAutoArtifactLedger({ db, treeId: tree.id }),
        readAutoTreeSpend({ db, treeId: tree.id }),
        listAutoOutbox({ db, treeId: tree.id, states: ['pending', 'dropped'] }),
        listAutoOutbox({ db, treeId: tree.id, states: ['accepted'] }),
        readFirstUserText({ db, agentId: tree.rootAgentId }),
        listAutoGrantsOfTree({ db, treeId: tree.id }),
        listAutoLaunchSnapshotsOfTree({ db, treeId: tree.id }),
      ]);
      const present = presentDelegationsOf({ delegations, goneChildIds: new Set(goneChildIds) });
      return {
        tree,
        delegations: present,
        hiddenChildIds: hiddenChildIdsOf({ delegations, present }),
        artifacts,
        budget: spend === null ? null : autoBudgetOf({ spend }),
        pendingRefusal: pendingRefusalOf({ tree, pending }),
        pendingMessages: pendingMessagesOf({ tree, pending }),
        readMessages: readMessagesOf({ tree, accepted, delegations }),
        droppedMessageIds: droppedMessageIdsOf({ tree, pending }),
        deliveredResults: deliveredResultsOf({ accepted }),
        rootAsk,
        level,
        grantAsks,
        launchSnapshots: Object.fromEntries(
          snapshots.map((row) => [String(row.delegationId), row.launchSnapshot]),
        ),
      };
    }),
  );
};
