import {
  finalizeResolveCandidateIntegration,
  getReadyResolveCandidateForItem,
  listResolveCandidateItems,
  listResolveCandidates,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
  setResolveAttemptFailureCause,
  setResolveCandidateState,
  setResolveQueueItemApproval,
} from '@goodboy/db';
import type { ResolveCandidate, ResolveQueueItemWithThread, ResolveThread } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  integrateWorktreeCandidate,
  worktreeCommitRange,
} from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { advanceResolveStage } from './advanceResolveStage';
import { withCandidateLock } from './candidateLock';
import { closeResolvedNote } from './closeResolvedNote';
import { hashResolveReply } from './hashResolveReply';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import { remapIntegratedCommits } from './remapIntegratedCommits';
import { attemptOfCandidate, laneChainOf } from './resolveLane';
import { saveResolveThread } from './saveResolveThread';
import { STALE_APPROVAL, StaleApprovalError, withStaleRecovery } from './staleApproval';
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
type Step = {
  readonly candidate: ResolveCandidate;
  readonly covered: ReadonlyArray<Covered>;
};

export const PARTIAL_ACCEPTANCE =
  'This change also answers comments you left for later. Resolve them together, or take those back up first';
const ACCEPT_CONFLICT =
  'The branch moved under this fix and it no longer applies on top of it. Fix it again';
const NO_LONGER_APPLIES = 'the fix no longer applies on the branch';
const BRANCH_MOVED = 'the branch moved';
const WAITING_FOR_REBUILD =
  'This fix is waiting to be rebuilt on top of the fixes before it. Accept it when it is ready';
const EARLIER_SET_ASIDE =
  'A fix before this one is set aside. Take it back up or refuse it first, then accept this one';

type ConflictParams = SliceParams &
  SessionParams & {
    readonly steps: ReadonlyArray<Step>;
  };

const markAcceptConflict = async ({
  set,
  get,
  sessionId,
  steps,
}: ConflictParams): Promise<void> => {
  const db = tauriDatabase;
  const attempts = await listResolveAttempts({ db, sessionId });
  const attemptIds = new Set<string>();
  for (const { candidate, covered } of steps) {
    await setResolveCandidateState({ db, candidateId: candidate.id, state: 'stale' });
    attemptIds.add(attemptOfCandidate({ attempts, candidateId: candidate.id })?.id ?? candidate.id);
    for (const { entry } of covered) {
      if (entry === undefined) {
        continue;
      }
      await saveResolveThread({
        db,
        row: { ...entry.thread, state: 'failed', updatedAt: Date.now() },
        expectedRevision: entry.thread.revision,
      });
      if (entry.thread.activeAttemptId !== null) {
        attemptIds.add(entry.thread.activeAttemptId);
      }
    }
  }
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

const stepOf = async ({
  candidate,
  entries,
}: {
  readonly candidate: ResolveCandidate;
  readonly entries: ReadonlyArray<ResolveQueueItemWithThread>;
}): Promise<Step> => {
  const members = await listResolveCandidateItems({
    db: tauriDatabase,
    candidateId: candidate.id,
  });
  return {
    candidate,
    covered: members.map((member) => ({
      queueItemId: member.queueItemId,
      itemRevision: member.itemRevision,
      entry: entries.find((entry) => entry.item.id === member.queueItemId),
    })),
  };
};

const isLagging = ({ itemRevision, entry }: Covered): boolean =>
  entry?.item.candidateRevision !== itemRevision || entry.thread.revision !== itemRevision;

const laggingItemIdsOf = ({
  steps,
}: {
  readonly steps: ReadonlyArray<Step>;
}): ReadonlyArray<string> =>
  steps.flatMap(({ covered }) => covered.filter(isLagging).map(({ queueItemId }) => queueItemId));

const assertAcceptable = ({
  steps,
  targetId,
}: {
  readonly steps: ReadonlyArray<Step>;
  readonly targetId: string;
}): void => {
  for (const { candidate, covered } of steps) {
    const isTarget = candidate.id === targetId;
    if (covered.some(({ entry }) => entry === undefined)) {
      throw new Error('This change covers a comment that is no longer open. Ask for the fix again');
    }
    if (covered.some(({ entry }) => entry?.item.approvalState === 'deferred')) {
      throw new Error(isTarget ? PARTIAL_ACCEPTANCE : EARLIER_SET_ASIDE);
    }
    if (covered.some(({ entry }) => entry?.item.approvalState === 'wont_fix')) {
      throw new Error(isTarget ? PARTIAL_REFUSAL : EARLIER_SET_ASIDE);
    }
    if (covered.some(isLagging)) {
      throw new StaleApprovalError({ itemIds: laggingItemIdsOf({ steps }) });
    }
  }
};

const landedShasOf = async ({
  worktreePath,
  steps,
  expectedHead,
  integrated,
}: {
  readonly worktreePath: string;
  readonly steps: ReadonlyArray<Step>;
  readonly expectedHead: string;
  readonly integrated: string;
}): Promise<ReadonlyMap<string, string>> => {
  const tip = steps.at(-1)?.candidate.candidateSha ?? integrated;
  const landed = new Map<string, string>();
  if (integrated === tip) {
    for (const { candidate } of steps) {
      landed.set(candidate.id, candidate.candidateSha);
    }
    return landed;
  }
  const before = await worktreeCommitRange({ worktreePath, base: expectedHead, head: tip }).catch(
    () => [],
  );
  const after = await worktreeCommitRange({
    worktreePath,
    base: `${integrated}~${before.length}`,
    head: integrated,
  }).catch(() => []);
  for (const { candidate } of steps) {
    const index = before.findIndex((commit) => commit.sha === candidate.candidateSha);
    landed.set(candidate.id, after[index]?.sha ?? integrated);
  }
  return landed;
};

const closeAcceptedNotes = async ({
  set,
  get,
  sessionId,
  threads,
}: SliceParams &
  SessionParams & { readonly threads: ReadonlyArray<ResolveThread> }): Promise<void> => {
  for (const thread of threads) {
    if (thread.originKind === 'diff_comment') {
      await closeResolvedNote({ set, get, sessionId, threadId: thread.threadId });
    }
  }
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
    await closeAcceptedNotes({
      set,
      get,
      sessionId,
      threads: approved === undefined ? [] : [approved.thread],
    });
    return;
  }
  const entries = await listResolveQueueItems({ db, sessionId });
  const target = entries.find((entry) => entry.item.id === itemId);
  if (target === undefined || target.item.candidateRevision !== revision) {
    throw new Error(STALE_APPROVAL);
  }
  const { chain } = laneChainOf({
    candidates: (await listResolveCandidates({ db, sessionId })).map((item) => ({
      candidate: item,
    })),
    worktreePath: candidate.worktreePath,
  });
  const position = chain.findIndex((link) => link.candidate.id === candidate.id);
  if (position < 0) {
    throw new Error(WAITING_FOR_REBUILD);
  }
  const steps: Array<Step> = [];
  for (const link of chain.slice(0, position + 1)) {
    steps.push(await stepOf({ candidate: link.candidate, entries }));
  }
  assertAcceptable({ steps, targetId: candidate.id });
  const expectedHead = steps[0]?.candidate.baseSha ?? candidate.baseSha;
  const integrated = await withCandidateLock({
    worktreePath: candidate.worktreePath,
    holder: `accept:${candidate.id}`,
    run: () =>
      integrateWorktreeCandidate({
        worktreePath: candidate.worktreePath,
        candidateId: candidate.id,
        candidateSha: candidate.candidateSha,
        expectedHead,
      }),
  }).catch((error: unknown) => {
    const text = formatError(error);
    if (!text.includes(NO_LONGER_APPLIES) && !text.includes(BRANCH_MOVED)) {
      throw error;
    }
    return null;
  });
  if (integrated === null) {
    await markAcceptConflict({ set, get, sessionId, steps });
    throw new Error(ACCEPT_CONFLICT);
  }
  const landed = await landedShasOf({
    worktreePath: candidate.worktreePath,
    steps,
    expectedHead,
    integrated,
  });
  for (const step of steps) {
    const approvals = await Promise.all(
      step.covered.map(async ({ queueItemId, itemRevision, entry }) => ({
        queueItemId,
        revision: itemRevision,
        replyHash:
          queueItemId === itemId
            ? replyHash
            : await hashResolveReply({ reply: entry?.thread.replyDraft ?? '' }),
      })),
    );
    await finalizeResolveCandidateIntegration({
      db,
      candidateId: step.candidate.id,
      integratedSha: landed.get(step.candidate.id) ?? integrated,
      approvals,
    });
  }
  await remapIntegratedCommits({
    sessionId,
    worktreePath: candidate.worktreePath,
    baseSha: expectedHead,
    candidateSha: candidate.candidateSha,
    integratedSha: integrated,
    threads: steps.flatMap(({ covered }) =>
      covered.flatMap(({ entry }) => (entry === undefined ? [] : [entry.thread])),
    ),
  }).catch(() => undefined);
  await advanceResolveStage({
    set,
    sessionId,
    threadIds: steps.flatMap(({ covered }) =>
      covered.flatMap(({ entry }) => (entry === undefined ? [] : [entry.thread.threadId])),
    ),
    event: () => ({ kind: 'user_approved' }),
  });
  await loadResolveQueueItemsInto({ set, sessionId });
  await loadResolveCandidatesInto({ set, sessionId });
  await closeAcceptedNotes({
    set,
    get,
    sessionId,
    threads: steps.flatMap(({ covered }) =>
      covered.flatMap(({ entry }) => (entry === undefined ? [] : [entry.thread])),
    ),
  });
};
