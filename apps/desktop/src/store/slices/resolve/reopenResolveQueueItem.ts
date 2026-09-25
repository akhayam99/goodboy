import { listResolveQueueItems, reopenResolveQueueItem as reopenItem } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { advanceResolveStage } from './advanceResolveStage';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import type { ItemRevisionParams, SliceParams } from './types';
import { hasThreadProposal } from './withNextStage';

type Params = SliceParams & Omit<ItemRevisionParams, 'reply'>;

export const reopenResolveQueueItem = async ({
  set,
  sessionId,
  itemId,
  revision,
}: Params): Promise<void> => {
  const entries = await listResolveQueueItems({ db: tauriDatabase, sessionId });
  const target = entries.find((entry) => entry.item.id === itemId);
  const reopened = await reopenItem({
    db: tauriDatabase,
    sessionId,
    itemId,
    id: crypto.randomUUID(),
    candidateRevision: revision,
  });
  if (reopened === null) {
    throw new Error('Resolve item could not be reopened');
  }
  if (target !== undefined) {
    await advanceResolveStage({
      set,
      sessionId,
      threadIds: [target.thread.threadId],
      event: (thread) =>
        thread.stage === 'resolved'
          ? { kind: 'github_reopened', hasProposal: hasThreadProposal({ thread }) }
          : { kind: 'user_unapproved' },
    });
  }
  await loadResolveQueueItemsInto({ set, sessionId });
};
