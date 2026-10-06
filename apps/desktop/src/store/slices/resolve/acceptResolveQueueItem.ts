import {
  finalizeResolveCandidateIntegration,
  getReadyResolveCandidateForItem,
  listResolveCandidateItems,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
  setResolveAttemptFailureCause,
  setResolveCandidateState,
  setResolveQueueItemApproval,
} from '@goodboy/db';
import type { ResolveQueueItemWithThread } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { integrateWorktreeCandidate } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { advanceResolveStage } from './advanceResolveStage';
import { withCandidateLock } from './candidateLock';
import { hashResolveReply } from './hashResolveReply';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import { remapIntegratedCommits } from './remapIntegratedCommits';
import { saveResolveThread } from './saveResolveThread';
import { STALE_APPROVAL, withStaleRecovery } from './staleApproval';
import { withSavedReplyDraft } from './saveResolveReplyDraft';
import {
  UNCAPTURED_WORK_ON_BRANCH,
  recoverUncapturedResolveWork,
} from './recoverUncapturedResolveWork';
import type { ItemRevisionParams, SessionParams, SliceParams } from './types';

type Params = SliceParams & ItemRevisionParams;
type Covered = {
  readonly queueItemId: string;
  readonly itemRevision: number;
  readonly entry: ResolveQueueItemWithThread | undefined;
};

export const PARTIAL_ACCEPTANCE =
  'This change also answers comments you left for later. Resolve them together, or take those back up first';
const ACCEPT_CONFLICT =
  'This fix collides with one accepted before it. Redo it on top of the branch';
const NO_LONGER_APPLIES = 'the fix no longer applies on the branch';

type ConflictParams = SliceParams &
  SessionParams & {
    readonly candidateId: string;
    readonly covered: ReadonlyArray<Covered>;
  };

const markAcceptConflict = async ({
  set,
  get,
  sessionId,
  candidateId,
  covered,
}: ConflictParams): Promise<void> => {
  const db = tauriDatabase;
  await setResolveCandidateState({ db, candidateId, state: 'stale' });
  for (const { entry } of covered) {
    if (entry === undefined) {
      continue;
    }
    await saveResolveThread({
      db,
      row: { ...entry.thread, state: 'failed', updatedAt: Date.now() },
      expectedRevision: entry.thread.revision,
    });
  }
  const attemptIds = new Set<string>([
    candidateId,
    ...covered.flatMap(({ entry }) =>
      entry?.thread.activeAttemptId == null ? [] : [entry.thread.activeAttemptId],
    ),
  ]);
  for (const id of attemptIds) {
    await setResolveAttemptFailureCause({ db, id, failureCause: 'accept_conflict' });
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

export const PARTIAL_REFUSAL =
  'This change also answers comments you said you will not fix. Take those back up first';

export const acceptResolveQueueItem = async ({
  set,
  get,
  sessionId,
  itemId,
  revision,
  reply,
}: Params): Promise<void> =>
  withStaleRecovery({
    set,
    get,
    sessionId,
    itemId,
    revision,
    run: ({ revision: current }) =>
      acceptAtRevision({ set, get, sessionId, itemId, revision: current, reply }),
  });

const acceptAtRevision = async ({
  set,
  get,
  sessionId,
  itemId,
  revision,
  reply,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const pending = await recoverUncapturedResolveWork({ set, get, sessionId });
  if (pending !== null) {
    throw new Error(UNCAPTURED_WORK_ON_BRANCH);
  }
  const openItems = await listResolveQueueItems({ db, sessionId });
  const openTarget = openItems.find((entry) => entry.item.id === itemId);
  if (openTarget !== undefined) {
    await withSavedReplyDraft({
      sessionId,
      threadId: openTarget.thread.threadId,
      revision,
      reply,
      decide: () => acceptDecidedItem({ set, get, sessionId, itemId, revision, reply }),
    });
    return;
  }
  await acceptDecidedItem({ set, get, sessionId, itemId, revision, reply });
};

const acceptDecidedItem = async ({
  set,
  get,
  sessionId,
  itemId,
  revision,
  reply,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const replyHash = await hashResolveReply({ reply });
  const candidate = await getReadyResolveCandidateForItem({ db, queueItemId: itemId });
  if (candidate === null) {
    const accepted = await setResolveQueueItemApproval({
      db,
      sessionId,
      itemId,
      revision,
      replyHash,
    });
    if (!accepted) {
      throw new Error(STALE_APPROVAL);
    }
    const approved = (await listResolveQueueItems({ db, sessionId })).find(
      (entry) => entry.item.id === itemId,
    );
    await advanceResolveStage({
      set,
      sessionId,
      threadIds: approved === undefined ? [] : [approved.thread.threadId],
      event: () => ({ kind: 'user_approved' }),
    });
    await loadResolveQueueItemsInto({ set, sessionId });
    return;
  }
  const entries = await listResolveQueueItems({ db, sessionId });
  const target = entries.find((entry) => entry.item.id === itemId);
  if (target === undefined || target.item.candidateRevision !== revision) {
    throw new Error(STALE_APPROVAL);
  }
  const members = await listResolveCandidateItems({ db, candidateId: candidate.id });
  const covered: ReadonlyArray<Covered> = members.map((member) => ({
    queueItemId: member.queueItemId,
    itemRevision: member.itemRevision,
    entry: entries.find((entry) => entry.item.id === member.queueItemId),
  }));
  if (covered.some(({ entry }) => entry === undefined)) {
    throw new Error('This change covers a comment that is no longer open. Ask for the fix again');
  }
  if (covered.some(({ entry }) => entry?.item.approvalState === 'deferred')) {
    throw new Error(PARTIAL_ACCEPTANCE);
  }
  if (covered.some(({ entry }) => entry?.item.approvalState === 'wont_fix')) {
    throw new Error(PARTIAL_REFUSAL);
  }
  if (
    covered.some(
      ({ itemRevision, entry }) =>
        entry?.item.candidateRevision !== itemRevision || entry.thread.revision !== itemRevision,
    )
  ) {
    throw new Error(STALE_APPROVAL);
  }
  const approvals = await Promise.all(
    covered.map(async ({ queueItemId, itemRevision, entry }) => ({
      queueItemId,
      revision: itemRevision,
      replyHash:
        queueItemId === itemId
          ? replyHash
          : await hashResolveReply({ reply: entry?.thread.replyDraft ?? '' }),
    })),
  );
  const integrated = await withCandidateLock({
    worktreePath: candidate.worktreePath,
    holder: `accept:${candidate.id}`,
    run: () =>
      integrateWorktreeCandidate({
        worktreePath: candidate.worktreePath,
        candidateId: candidate.id,
        candidateSha: candidate.candidateSha,
        expectedHead: candidate.baseSha,
      }),
  }).catch((error: unknown) => {
    if (!formatError(error).includes(NO_LONGER_APPLIES)) {
      throw error;
    }
    return null;
  });
  if (integrated === null) {
    await markAcceptConflict({ set, get, sessionId, candidateId: candidate.id, covered });
    throw new Error(ACCEPT_CONFLICT);
  }
  const integratedSha = integrated;
  await finalizeResolveCandidateIntegration({
    db,
    candidateId: candidate.id,
    integratedSha,
    approvals,
  });
  await remapIntegratedCommits({
    sessionId,
    worktreePath: candidate.worktreePath,
    baseSha: candidate.baseSha,
    candidateSha: candidate.candidateSha,
    integratedSha,
    threads: covered.flatMap(({ entry }) => (entry === undefined ? [] : [entry.thread])),
  }).catch(() => undefined);
  await advanceResolveStage({
    set,
    sessionId,
    threadIds: covered.flatMap(({ entry }) => (entry === undefined ? [] : [entry.thread.threadId])),
    event: () => ({ kind: 'user_approved' }),
  });
  await loadResolveQueueItemsInto({ set, sessionId });
  await loadResolveCandidatesInto({ set, sessionId });
};
