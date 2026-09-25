import { listResolveQueueItems, undeferResolveQueueItem } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { advanceResolveStage } from './advanceResolveStage';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import type { ItemParams, SliceParams } from './types';
import { hasThreadProposal } from './withNextStage';

type Params = SliceParams & ItemParams;

export const takeUpResolveQueueItem = async ({ set, sessionId, itemId }: Params): Promise<void> => {
  const entries = await listResolveQueueItems({ db: tauriDatabase, sessionId });
  const target = entries.find((entry) => entry.item.id === itemId);
  const takenUp = await undeferResolveQueueItem({ db: tauriDatabase, sessionId, itemId });
  if (!takenUp) {
    throw new Error('Resolve item could not be taken up');
  }
  if (target !== undefined) {
    await advanceResolveStage({
      set,
      sessionId,
      threadIds: [target.thread.threadId],
      event: (thread) => ({
        kind: 'user_resumed',
        hasProposal: target.item.integratedSha !== null || hasThreadProposal({ thread }),
      }),
    });
  }
  await loadResolveQueueItemsInto({ set, sessionId });
};
