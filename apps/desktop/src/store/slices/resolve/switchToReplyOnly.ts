import {
  getReadyResolveCandidateForItem,
  listResolveAttempts,
  listResolveCandidateItems,
  listResolveQueueItems,
  listResolveThreads,
  rebaseResolveQueueItem,
  setResolveCandidateState,
} from '@goodboy/db';
import type { ResolveThread } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import { saveResolveThread } from './saveResolveThread';
import { STALE_APPROVAL } from './staleApproval';
import type { SliceParams, ThreadParams } from './types';

type Params = SliceParams & ThreadParams;

const SHARED_CHANGE_BLOCKS_REPLY_ONLY =
  'This change also answers other comments. Answer those first, or keep the change';

const FIX_ALREADY_ON_BRANCH =
  'This fix is already on the branch, so it cannot be dropped here. Keep it, or revert it on the branch first';

const hasCommittedFix = ({ thread }: { readonly thread: ResolveThread }): boolean =>
  thread.disposition === 'fix' && (thread.commitShas?.length ?? 0) > 0;

export const switchToReplyOnly = async ({
  set,
  get,
  sessionId,
  threadId,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const target = (await listResolveQueueItems({ db, sessionId })).find(
    (entry) => entry.thread.threadId === threadId,
  );
  if (target === undefined) {
    throw new Error('This comment is no longer in Review');
  }
  if (target.item.approvalState !== 'none') {
    throw new Error('Undo the decision on this comment first');
  }
  const candidate = await getReadyResolveCandidateForItem({ db, queueItemId: target.item.id });
  const previous = (await listResolveThreads({ db, sessionId })).find(
    (row) => row.threadId === threadId,
  );
  if (previous === undefined) {
    throw new Error(STALE_APPROVAL);
  }
  if (candidate === null && hasCommittedFix({ thread: previous })) {
    throw new Error(FIX_ALREADY_ON_BRANCH);
  }
  if (candidate !== null) {
    const members = await listResolveCandidateItems({ db, candidateId: candidate.id });
    if (members.some((member) => member.queueItemId !== target.item.id)) {
      throw new Error(SHARED_CHANGE_BLOCKS_REPLY_ONLY);
    }
    await setResolveCandidateState({ db, candidateId: candidate.id, state: 'discarded' });
  }
  const saved = await saveResolveThread({
    db,
    row: {
      ...previous,
      state: 'answered',
      disposition: 'no_change',
      commitShas: null,
      question: null,
      updatedAt: Date.now(),
    },
    expectedRevision: previous.revision,
    previous,
  });
  if (!saved) {
    throw new Error(STALE_APPROVAL);
  }
  const current = (await listResolveThreads({ db, sessionId })).find(
    (row) => row.threadId === threadId,
  );
  await rebaseResolveQueueItem({
    db,
    sessionId,
    itemId: target.item.id,
    candidateRevision: current?.revision ?? previous.revision + 1,
  });
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
