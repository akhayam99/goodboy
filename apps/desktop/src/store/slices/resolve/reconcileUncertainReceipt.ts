import { upsertResolvePublicationThread } from '@goodboy/db';
import type { PrComment, ResolvePublicationThread } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { activeReviewSourceOf } from '../review-source/activeReviewSource';
import { reconcileReplyOperation, type ReplyOperationVerdict } from './reconcileReplyOperation';
import { viewerLoginsOf } from './viewerLogins';
import type { GetFn, SessionParams } from './types';

type Params = SessionParams & {
  readonly get: GetFn;
  readonly receipt: ResolvePublicationThread;
};

export const AMBIGUOUS_REPLY = 'a reply may already be on this conversation';

export const reconcileUncertainReceipt = async ({
  get,
  sessionId,
  receipt,
}: Params): Promise<ReplyOperationVerdict> => {
  if (receipt.replyPhase !== 'uncertain') {
    return 'not_posted';
  }
  await get()
    .refreshReviewSource({ sessionId, force: true })
    .catch(() => undefined);
  const source = activeReviewSourceOf({ state: get(), sessionId });
  const comments: ReadonlyArray<PrComment> = source?.comments ?? [];
  const fetchedAt = source?.fetchedAt ?? null;
  const verdict = reconcileReplyOperation({
    thread: receipt,
    comments,
    observedAt: fetchedAt === null ? null : new Date(fetchedAt).getTime(),
    isObservationTrusted: source?.error == null && source?.hasDetail === true,
    viewerLogins: viewerLoginsOf({ state: get() }),
  });
  if (verdict === 'posted') {
    await upsertResolvePublicationThread({
      db: tauriDatabase,
      thread: { ...receipt, replyPhase: 'posted', replyPostedAt: Date.now(), error: null },
    });
  }
  if (verdict === 'ambiguous') {
    await upsertResolvePublicationThread({
      db: tauriDatabase,
      thread: { ...receipt, error: AMBIGUOUS_REPLY },
    });
  }
  return verdict;
};
