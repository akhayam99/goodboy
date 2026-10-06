import {
  getReadyResolveCandidateForItem,
  keepResolveDraftCurrent,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
} from '@goodboy/db';
import type { ResolveQueueItemWithThread, ResolveThread } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import type { ItemParams, SliceParams } from './types';

export const STALE_APPROVAL = 'This answer changed since you opened it. Review it again.';

type RunParams = { readonly revision: number };
type GuardParams = SliceParams &
  ItemParams & {
    readonly revision: number;
    readonly run: (params: RunParams) => Promise<void>;
  };
type EntryParams = { readonly entry: ResolveQueueItemWithThread | undefined };
type SameAnswerParams = { readonly seen: ResolveThread; readonly fresh: ResolveThread };

const isStaleApproval = ({ error }: { readonly error: unknown }): boolean =>
  error instanceof Error && error.message === STALE_APPROVAL;

const isUndelivered = ({ entry }: EntryParams): boolean =>
  entry !== undefined && entry.item.deliveredAt === null && entry.item.integratedSha === null;

const sameAnswer = ({ seen, fresh }: SameAnswerParams): boolean =>
  seen.state === fresh.state &&
  seen.disposition === fresh.disposition &&
  seen.replyDraft === fresh.replyDraft &&
  seen.question === fresh.question &&
  seen.fixupOfSha === fresh.fixupOfSha &&
  seen.replacesSha === fresh.replacesSha &&
  JSON.stringify(seen.commitShas) === JSON.stringify(fresh.commitShas);

const refreshView = async ({
  set,
  get,
  sessionId,
}: SliceParams & Pick<ItemParams, 'sessionId'>) => {
  const db = tauriDatabase;
  projectResolveRows({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db, sessionId }),
    attempts: await listResolveAttempts({ db, sessionId }),
  });
  await loadResolveQueueItemsInto({ set, sessionId });
  await loadResolveCandidatesInto({ set, sessionId });
};

const entryOf = async ({
  sessionId,
  itemId,
}: ItemParams): Promise<ResolveQueueItemWithThread | undefined> =>
  (await listResolveQueueItems({ db: tauriDatabase, sessionId })).find(
    (candidate) => candidate.item.id === itemId,
  );

const freshRevision = async ({
  get,
  sessionId,
  itemId,
  revision,
}: Pick<SliceParams, 'get'> & ItemParams & RunParams): Promise<number | null> => {
  const db = tauriDatabase;
  const entry = await entryOf({ sessionId, itemId });
  if (entry === undefined || !isUndelivered({ entry })) {
    return null;
  }
  const seen = (get().sessionResolveThreads[sessionId] ?? []).find(
    (row) => row.threadId === entry.thread.threadId,
  );
  if (
    seen === undefined ||
    seen.revision !== revision ||
    !sameAnswer({ seen, fresh: entry.thread })
  ) {
    return null;
  }
  const ready = await getReadyResolveCandidateForItem({ db, queueItemId: itemId });
  const seenReady = (get().sessionResolveCandidates[sessionId] ?? []).find(
    ({ candidate, items }) =>
      candidate.state === 'ready' && items.some((item) => item.queueItemId === itemId),
  );
  if (
    ready?.id !== seenReady?.candidate.id ||
    ready?.candidateSha !== seenReady?.candidate.candidateSha
  ) {
    return null;
  }
  await keepResolveDraftCurrent({
    db,
    sessionId,
    threadId: entry.thread.threadId,
    fromRevision: entry.item.candidateRevision,
  });
  const settled = await entryOf({ sessionId, itemId });
  return settled !== undefined && settled.item.candidateRevision === settled.thread.revision
    ? settled.thread.revision
    : null;
};

export const withStaleRecovery = async ({
  set,
  get,
  sessionId,
  itemId,
  revision,
  run,
}: GuardParams): Promise<void> => {
  try {
    await run({ revision });
    return;
  } catch (error) {
    if (!isStaleApproval({ error })) {
      throw error;
    }
  }
  const fresh = await freshRevision({ get, sessionId, itemId, revision });
  if (fresh === null) {
    await refreshView({ set, get, sessionId });
    throw new Error(STALE_APPROVAL);
  }
  try {
    await run({ revision: fresh });
  } catch (error) {
    if (isStaleApproval({ error })) {
      await refreshView({ set, get, sessionId });
    }
    throw error;
  }
};
