import {
  discardResolveFix,
  getReadyResolveCandidateForItem,
  listResolveAttempts,
  listResolveCandidateItems,
  listResolveQueueItems,
  listResolveThreads,
} from '@goodboy/db';
import type { ResolveThread } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { loadResolveCandidatesInto } from '../loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from '../loadResolveQueueItemsInto';
import { projectResolveRows } from '../projectResolveRows';
import { withNextStage } from '../withNextStage';
import { DISCARD_FIX_ERROR } from './discardFixError';
import { STALE_APPROVAL } from '../staleApproval';
import type { DiscardFixParams, SliceParams } from '../types';

type Params = SliceParams & DiscardFixParams;

type ThreadRowParams = {
  readonly thread: ResolveThread;
};

type OpenedParams = ThreadRowParams & {
  readonly now: number;
};

const hasCommittedFix = ({ thread }: ThreadRowParams): boolean =>
  thread.disposition === 'fix' && (thread.commitShas?.length ?? 0) > 0;

const openedRowOf = ({ thread, now }: OpenedParams): ResolveThread =>
  withNextStage({
    previous: thread,
    row: {
      ...thread,
      state: 'open',
      disposition: null,
      replyDraft: null,
      commitShas: null,
      question: null,
      updatedAt: now,
    },
  });

export const discardProposedFix = async ({
  set,
  get,
  sessionId,
  threadId,
  worktreePath,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const entries = await listResolveQueueItems({ db, sessionId });
  const target = entries.find((entry) => entry.thread.threadId === threadId);
  if (target === undefined) {
    throw new Error(DISCARD_FIX_ERROR.missing);
  }
  if (target.item.approvalState !== 'none') {
    throw new Error(DISCARD_FIX_ERROR.decided);
  }
  const threads = await listResolveThreads({ db, sessionId });
  const previous = threads.find((row) => row.threadId === threadId);
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
  if (candidate !== null && worktreePath !== null && candidate.worktreePath !== worktreePath) {
    throw new Error(DISCARD_FIX_ERROR.otherWorktree);
  }
  const memberIds =
    candidate === null
      ? [target.item.id]
      : (await listResolveCandidateItems({ db, candidateId: candidate.id })).map(
          (member) => member.queueItemId,
        );
  const members = entries.filter((entry) => memberIds.includes(entry.item.id));
  if (members.some((entry) => entry.item.approvalState !== 'none')) {
    throw new Error(DISCARD_FIX_ERROR.sharedDecided);
  }
  const now = Date.now();
  const discarded = members.flatMap((entry) => {
    const before = threads.find((row) => row.threadId === entry.thread.threadId);
    if (before === undefined || before.stage !== 'proposed') {
      return [];
    }
    return [
      {
        row: openedRowOf({ thread: before, now }),
        expectedRevision: before.revision,
        itemId: entry.item.id,
      },
    ];
  });
  if (discarded.length !== memberIds.length) {
    throw new Error(STALE_APPROVAL);
  }
  const isDiscarded = await discardResolveFix({
    db,
    candidateId: candidate?.id ?? null,
    threads: discarded,
  });
  if (!isDiscarded) {
    throw new Error(STALE_APPROVAL);
  }
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
