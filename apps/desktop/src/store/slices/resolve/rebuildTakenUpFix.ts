import {
  getReadyResolveCandidateForItem,
  listResolveAttempts,
  listResolveQueueItems,
} from '@goodboy/db';
import { draftRoutingOf } from '../../../features/resolve/draftRouting';
import { LANE_REBUILD_HINT } from '../../../features/resolve/laneCopy';
import { launchChoiceOf } from '../../../features/resolve/launchChoice';
import { startBatch } from '../../../features/resolve/startBatch';
import { tauriDatabase } from '../../../shared/lib/db';
import type { ItemParams, SliceParams } from './types';

type Params = SliceParams & ItemParams;

export const rebuildTakenUpFix = async ({ get, sessionId, itemId }: Params): Promise<void> => {
  const db = tauriDatabase;
  const entry = (await listResolveQueueItems({ db, sessionId })).find(
    ({ item }) => item.id === itemId,
  );
  if (
    entry === undefined ||
    entry.thread.disposition !== 'fix' ||
    entry.item.integratedSha !== null ||
    entry.item.approvalState !== 'none' ||
    entry.thread.state !== 'fixed' ||
    (await getReadyResolveCandidateForItem({ db, queueItemId: itemId })) !== null
  ) {
    return;
  }
  const previous = [...(await listResolveAttempts({ db, sessionId }))]
    .reverse()
    .find((attempt) => attempt.threadIds.includes(entry.thread.threadId));
  const choice =
    previous?.launchChoice ??
    launchChoiceOf({
      routing: draftRoutingOf({ state: get(), sessionId }),
      commitStyle: null,
      hint: null,
    });
  await startBatch({
    getState: get,
    sessionId,
    threadIds: [entry.thread.threadId],
    launchChoice: {
      ...choice,
      hint: [choice.hint, LANE_REBUILD_HINT].filter((part) => part !== null).join('\n\n'),
    },
  });
};
