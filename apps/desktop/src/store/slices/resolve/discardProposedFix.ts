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
import { DISCARD_FIX_ERROR } from './discardFixError';
import { STALE_APPROVAL } from './staleApproval';
import type { DiscardFixParams, SliceParams } from './types';

type Params = SliceParams & DiscardFixParams;

type ThreadRowParams = {
  readonly thread: ResolveThread;
};

const hasCommittedFix = ({ thread }: ThreadRowParams): boolean =>
  thread.disposition === 'fix' && (thread.commitShas?.length ?? 0) > 0;

export const discardProposedFix = async ({
  set,
  get,
  sessionId,
  threadId,
  worktreePath,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const target = (await listResolveQueueItems({ db, sessionId })).find(
    (entry) => entry.thread.threadId === threadId,
  );
  if (target === undefined) {
    throw new Error(DISCARD_FIX_ERROR.missing);
  }
  if (target.item.approvalState !== 'none') {
    throw new Error(DISCARD_FIX_ERROR.decided);
  }
  const previous = (await listResolveThreads({ db, sessionId })).find(
    (row) => row.threadId === threadId,
  );
  if (previous === undefined) {
    throw new Error(STALE_APPROVAL);
  }
  if (previous.stage !== 'proposed') {
    throw new Error(DISCARD_FIX_ERROR.noFix);
  }
  const candidate = await getReadyResolveCandidateForItem({ db, queueItemId: target.item.id });
  if (candidate === null && hasCommittedFix({ thread: previous })) {
    throw new Error(DISCARD_FIX_ERROR.onBranch);
  }
  if (candidate !== null) {
    if (worktreePath !== null && candidate.worktreePath !== worktreePath) {
      throw new Error(DISCARD_FIX_ERROR.otherWorktree);
    }
    const members = await listResolveCandidateItems({ db, candidateId: candidate.id });
    if (members.some((member) => member.queueItemId !== target.item.id)) {
      throw new Error(DISCARD_FIX_ERROR.shared);
    }
  }
  const isSaved = await saveResolveThread({
    db,
    row: {
      ...previous,
      state: 'open',
      disposition: null,
      replyDraft: null,
      commitShas: null,
      question: null,
      updatedAt: Date.now(),
    },
    expectedRevision: previous.revision,
    previous,
  });
  if (!isSaved) {
    throw new Error(STALE_APPROVAL);
  }
  if (candidate !== null) {
    await setResolveCandidateState({ db, candidateId: candidate.id, state: 'discarded' });
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
