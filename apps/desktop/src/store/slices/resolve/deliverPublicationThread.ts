import {
  listResolvePublicationThreads,
  listResolveQueueItems,
  listResolveThreads,
  markResolveQueueItemDelivered,
  upsertResolvePublicationThread,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { ResolvePublicationThread, ResolveThread, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { postThreadReply } from '../github/postThreadReply';
import { isDeliveryComplete } from './deriveResolveQueueStatus';
import { markThreadDone } from './markThreadDone';
import type { ResolveStepPlan } from './resolveStepPlan';
import { restoreResolvePublication } from './restoreResolvePublication';
import type { GetFn } from './types';

const UNCERTAIN = /timeout|timed out|etimedout|econnreset|network|socket hang up/i;

type ReceiptParams = {
  readonly publicationId: string;
  readonly fallback: ResolvePublicationThread;
};

const latestReceipt = async ({
  publicationId,
  fallback,
}: ReceiptParams): Promise<ResolvePublicationThread> =>
  (await listResolvePublicationThreads({ db: tauriDatabase, publicationId })).find(
    (receipt) => receipt.threadId === fallback.threadId,
  ) ?? fallback;

const failedStepReceipt = ({
  receipt,
  error,
}: {
  readonly receipt: ResolvePublicationThread;
  readonly error: string;
}): ResolvePublicationThread => {
  const isUncertain = UNCERTAIN.test(error);
  if (receipt.replyPhase === 'sending') {
    return { ...receipt, replyPhase: isUncertain ? 'uncertain' : 'pending', error };
  }
  if (receipt.resolvePhase === 'resolving') {
    return { ...receipt, resolvePhase: isUncertain ? 'uncertain' : 'pending', error };
  }
  return { ...receipt, error };
};

type MarkDeliveredParams = {
  readonly sessionId: SessionId;
  readonly thread: ResolvePublicationThread;
};

const markDelivered = async ({ sessionId, thread }: MarkDeliveredParams): Promise<void> => {
  const items = await listResolveQueueItems({ db: tauriDatabase, sessionId });
  const match = items.find(
    ({ item }) =>
      item.threadId === thread.threadId &&
      (item.approvalState === 'accepted' || item.approvalState === 'wont_fix') &&
      item.approvedRevision === thread.revision,
  );
  if (match === undefined) {
    throw new Error('This item no longer carries the approval it was published under');
  }
  const delivered = await markResolveQueueItemDelivered({
    db: tauriDatabase,
    sessionId,
    itemId: match.item.id,
    deliveredAt: Date.now(),
  });
  if (!delivered) {
    throw new Error('This item could not be marked done');
  }
};

type SettleParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly thread: ResolvePublicationThread;
};

const settleOpenRow = async ({ get, sessionId, thread }: SettleParams): Promise<void> => {
  const row = (await listResolveThreads({ db: tauriDatabase, sessionId })).find(
    (candidate) => candidate.threadId === thread.threadId,
  );
  if (row?.state !== 'publishing') {
    return;
  }
  await get().updateResolveThread({
    sessionId,
    threadId: thread.threadId,
    revision: row.revision,
    patch: { state: thread.priorState === 'publishing' ? 'answered' : thread.priorState },
  });
};

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly publicationId: string;
  readonly thread: ResolvePublicationThread;
  readonly previous: ResolveThread | undefined;
  readonly plan: ResolveStepPlan;
};

export const deliverPublicationThread = async ({
  get,
  sessionId,
  publicationId,
  thread,
  previous,
  plan,
}: Params): Promise<ResolvePublicationThread> => {
  const current = await latestReceipt({ publicationId, fallback: thread });
  if (current.error === null && isDeliveryComplete({ receipt: current })) {
    return current;
  }
  const attempt: ResolvePublicationThread = { ...current, error: null };
  try {
    const reply = await postThreadReply({
      get,
      sessionId,
      threadId: thread.threadId,
      replyBody: attempt.replyBody,
      frozen: attempt,
    });
    const replied = await latestReceipt({ publicationId, fallback: attempt });
    if (attempt.resolvePhase === 'skipped') {
      if (reply.posted) {
        await markDelivered({ sessionId, thread: replied });
      }
      await settleOpenRow({ get, sessionId, thread: replied });
      return replied;
    }
    const done = await markThreadDone({
      get,
      sessionId,
      threadId: thread.threadId,
      frozen: replied,
      plan,
    });
    await markDelivered({ sessionId, thread: done });
    return done;
  } catch (err) {
    const error = formatError(err);
    const failed = failedStepReceipt({
      receipt: await latestReceipt({ publicationId, fallback: attempt }),
      error,
    });
    await upsertResolvePublicationThread({ db: tauriDatabase, thread: failed });
    await restoreResolvePublication({
      get,
      sessionId,
      threadId: thread.threadId,
      previous,
      hasCommit: failed.resolvePhase !== 'skipped',
      error: UNCERTAIN.test(error) ? `uncertain: ${error}` : error,
    });
    return failed;
  }
};
