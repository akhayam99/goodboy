import { upsertResolvePublicationThread } from '@goodboy/db';
import type { ResolvePublicationThread, SessionId } from '@goodboy/types';
import { threadFixSha } from '../../../features/resolve/threadFixSha';
import { tauriDatabase } from '../../../shared/lib/db';
import { recordPostedReply } from '../resolve/commitStory';
import { providerThreadIdOf } from '../resolve/resolveThreadSource';
import { activeReviewSourceOf } from '../review-source/activeReviewSource';
import { reviewSourceFor } from '../review-source/reviewSourceFor';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly replyBody: string | null;
  readonly frozen: ResolvePublicationThread;
};

const fallbackRow = ({ threadId }: { readonly threadId: string }) => ({
  threadId,
  originKind: 'review_comment' as const,
  sourceKind: undefined,
  providerThreadId: null,
  projectId: null,
  prNumber: null,
});

export type PostedReply = { readonly posted: boolean; readonly replyId: string | null };

export const postThreadReply = async ({
  get,
  sessionId,
  threadId,
  replyBody,
  frozen,
}: Params): Promise<PostedReply> => {
  const receipt = get().sessionResolveThreads[sessionId]?.find((row) => row.threadId === threadId);
  if (frozen.replyPhase === 'posted') {
    return { posted: false, replyId: frozen.replyId };
  }
  if (receipt !== undefined && receipt.replyPostedAt !== null) {
    await upsertResolvePublicationThread({
      db: tauriDatabase,
      thread: {
        ...frozen,
        replyPhase: 'posted',
        replyId: receipt.replyId ?? frozen.replyId,
        replyPostedAt: receipt.replyPostedAt,
      },
    });
    return { posted: false, replyId: receipt.replyId ?? frozen.replyId };
  }
  if (replyBody === null) {
    return { posted: false, replyId: null };
  }
  const attemptedAt = Date.now();
  await upsertResolvePublicationThread({
    db: tauriDatabase,
    thread: { ...frozen, replyPhase: 'sending', replyAttemptedAt: attemptedAt },
  });
  const row = receipt ?? fallbackRow({ threadId });
  const posted = await reviewSourceFor({ get, sessionId, row }).reply({
    providerThreadId: providerThreadIdOf({ row }),
    body: replyBody,
  });
  const postedAt = Date.now();
  await get().updateResolveThread({
    sessionId,
    threadId,
    prNumber: activeReviewSourceOf({ state: get(), sessionId })?.prNumber,
    patch: { replyPostedAt: postedAt, replyId: posted.id },
  });
  const fixSha =
    receipt?.disposition === 'fix' ? threadFixSha({ commitShas: receipt.commitShas }) : null;
  if (fixSha !== null) {
    await recordPostedReply({ sessionId, threadId, sha: fixSha, body: replyBody }).catch(
      () => undefined,
    );
  }
  await upsertResolvePublicationThread({
    db: tauriDatabase,
    thread: {
      ...frozen,
      replyPhase: 'posted',
      replyId: posted.id,
      replyAttemptedAt: attemptedAt,
      replyPostedAt: postedAt,
    },
  });
  return { posted: true, replyId: posted.id };
};
