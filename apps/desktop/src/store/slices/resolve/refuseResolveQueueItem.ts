import { listResolveQueueItems, refuseResolveQueueItem as refuseItem } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { STALE_APPROVAL, withStaleRecovery } from './staleApproval';
import { advanceResolveStage } from './advanceResolveStage';
import { hashResolveReply } from './hashResolveReply';
import { withSavedReplyDraft } from './saveResolveReplyDraft';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import type { ItemRevisionParams, SliceParams } from './types';

type Params = SliceParams & ItemRevisionParams;

export const REFUSAL_AFTER_INTEGRATION = 'Fix already integrated';
export const EMPTY_REFUSAL_REPLY = 'Write the reply the reviewer will read before you refuse';

export const refuseResolveQueueItem = async ({
  set,
  get,
  sessionId,
  itemId,
  revision,
  reply,
}: Params): Promise<void> => {
  if (reply.trim() === '') {
    throw new Error(EMPTY_REFUSAL_REPLY);
  }
  await withStaleRecovery({
    set,
    get,
    sessionId,
    itemId,
    revision,
    run: ({ revision: current }) =>
      refuseAtRevision({ set, get, sessionId, itemId, revision: current, reply }),
  });
};

const refuseAtRevision = async ({
  set,
  sessionId,
  itemId,
  revision,
  reply,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const entries = await listResolveQueueItems({ db, sessionId });
  const target = entries.find((entry) => entry.item.id === itemId);
  if (target !== undefined && target.item.integratedSha !== null) {
    throw new Error(REFUSAL_AFTER_INTEGRATION);
  }
  const replyHash = await hashResolveReply({ reply });
  const decide = async (): Promise<void> => {
    const refused = await refuseItem({ db, sessionId, itemId, revision, replyHash });
    if (!refused) {
      throw new Error(STALE_APPROVAL);
    }
  };
  if (target === undefined) {
    await decide();
  } else {
    await withSavedReplyDraft({
      sessionId,
      threadId: target.thread.threadId,
      revision,
      reply,
      decide,
    });
    await advanceResolveStage({
      set,
      sessionId,
      threadIds: [target.thread.threadId],
      event: () => ({ kind: 'user_approved' }),
    });
  }
  await loadResolveQueueItemsInto({ set, sessionId });
};
