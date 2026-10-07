import {
  getResolveCandidate,
  insertResolveCandidate,
  insertResolveCandidateItem,
  listResolveAttempts,
  listResolveCandidates,
  listResolveQueueItems,
  markOverlappingResolveCandidatesStale,
  markResolveCandidateReady,
  setResolveCandidateState,
  setResolveThreadCommitShas,
} from '@goodboy/db';
import type { ResolveCandidate, ResolveQueueItemWithThread, SessionId } from '@goodboy/types';
import {
  quarantineWorktreeCandidate,
  splitWorktreeCandidates,
} from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { withCandidateLock } from './candidateLock';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { recordCommitLinks } from './recordCommitLinks';
import { ResolveFailure } from './resolveFailure';
import type { CandidateCaptureParams, SliceParams } from './types';

type Params = SliceParams & CandidateCaptureParams;

type Split = {
  readonly id: string;
  readonly sha: string;
  readonly entry: ResolveQueueItemWithThread;
};

const fixShaOf = ({ entry }: { readonly entry: ResolveQueueItemWithThread }): string | null =>
  entry.thread.disposition === 'fix' ? (entry.thread.commitShas?.at(-1) ?? null) : null;

const splitOneCandidatePerFix = async ({
  candidate,
  fixes,
  capturePath,
}: {
  readonly candidate: ResolveCandidate;
  readonly fixes: ReadonlyArray<ResolveQueueItemWithThread>;
  readonly capturePath: string;
}): Promise<ReadonlyArray<Split>> => {
  const picks = fixes.flatMap((entry, index) => {
    const commitSha = fixShaOf({ entry });
    return commitSha === null
      ? []
      : [{ entry, candidateId: `${candidate.id}-${index + 1}`, commitSha }];
  });
  const done = await splitWorktreeCandidates({
    worktreePath: capturePath,
    baseSha: candidate.baseSha,
    picks: picks.map(({ candidateId, commitSha }) => ({ candidateId, commitSha })),
    stack: true,
  });
  const splits = done.flatMap(({ candidateId, sha }): ReadonlyArray<Split> => {
    const pick = picks.find((item) => item.candidateId === candidateId);
    return pick === undefined || sha === null ? [] : [{ id: candidateId, sha, entry: pick.entry }];
  });
  return picks.length === fixes.length && splits.length === picks.length ? splits : [];
};

const registerSplit = async ({
  sessionId,
  candidate,
  baseSha,
  split,
}: {
  readonly sessionId: SessionId;
  readonly candidate: ResolveCandidate;
  readonly baseSha: string;
  readonly split: Split;
}): Promise<void> => {
  const db = tauriDatabase;
  const now = Date.now();
  await insertResolveCandidate({
    db,
    candidate: {
      ...candidate,
      id: split.id,
      revision: (await listResolveCandidates({ db, sessionId })).length + 1,
      baseSha,
      candidateSha: split.sha,
      state: 'ready',
      integratedSha: null,
      createdAt: now,
      updatedAt: now,
    },
  });
  await insertResolveCandidateItem({
    db,
    item: {
      candidateId: split.id,
      queueItemId: split.entry.item.id,
      itemRevision: split.entry.item.candidateRevision,
    },
  });
  await setResolveThreadCommitShas({
    db,
    sessionId,
    threadId: split.entry.thread.threadId,
    commitShas: [split.sha],
  });
  await recordCommitLinks({
    sessionId,
    worktreePath: candidate.worktreePath,
    baseSha,
    candidateSha: split.sha,
    threads: [{ ...split.entry.thread, commitShas: [split.sha] }],
  }).catch(() => undefined);
  await markOverlappingResolveCandidatesStale({ db, candidateId: split.id });
};

export const captureResolveCandidate = async ({
  set,
  sessionId,
  attemptId,
  threadIds,
}: Params): Promise<string | null> => {
  const db = tauriDatabase;
  const attempt = (await listResolveAttempts({ db, sessionId })).find(
    (item) => item.id === attemptId,
  );
  const candidate = await getResolveCandidate({ db, candidateId: attemptId });
  if (candidate === null) {
    if (attempt?.copyPath != null) {
      throw new ResolveFailure({
        failureCause: 'capture_failed',
        message: 'the run had no candidate to save its commits',
      });
    }
    return null;
  }
  if (candidate.state !== 'building') {
    return null;
  }
  const covered = (await listResolveQueueItems({ db, sessionId })).filter(
    ({ item, thread }) =>
      threadIds.includes(item.threadId) &&
      item.approvalState !== 'accepted' &&
      thread.state !== 'closed',
  );
  const copyPath = attempt?.copyPath ?? null;
  const capturePath = copyPath ?? candidate.worktreePath;
  const isStacked = copyPath !== null;
  const discard = async (): Promise<null> => {
    if (isStacked) {
      await withCandidateLock({
        worktreePath: capturePath,
        holder: `candidate:${candidate.id}`,
        run: () =>
          quarantineWorktreeCandidate({
            worktreePath: capturePath,
            candidateId: candidate.id,
            baseSha: candidate.baseSha,
          }),
      }).catch(() => undefined);
    }
    await setResolveCandidateState({ db, candidateId: candidate.id, state: 'discarded' });
    await loadResolveCandidatesInto({ set, sessionId });
    return null;
  };
  if (covered.length === 0) {
    return discard();
  }
  const fixes = covered.filter((entry) => fixShaOf({ entry }) !== null);
  const captured = await withCandidateLock({
    worktreePath: capturePath,
    holder: `candidate:${candidate.id}`,
    run: async () => {
      const quarantined = await quarantineWorktreeCandidate({
        worktreePath: capturePath,
        candidateId: candidate.id,
        baseSha: candidate.baseSha,
        stack: isStacked,
      });
      const splits =
        quarantined.sha === null || !isStacked || fixes.length < 2
          ? []
          : await splitOneCandidatePerFix({ candidate, fixes, capturePath }).catch(
              (): ReadonlyArray<Split> => [],
            );
      return { sha: quarantined.sha, splits };
    },
  });
  if (captured.sha === null) {
    return discard();
  }
  let chainBase = candidate.baseSha;
  for (const split of captured.splits) {
    await registerSplit({ sessionId, candidate, baseSha: chainBase, split });
    chainBase = split.sha;
  }
  const splitItemIds = new Set(captured.splits.map(({ entry }) => entry.item.id));
  const rest = (fixes.length === 0 ? covered : fixes).filter(
    (entry) => !splitItemIds.has(entry.item.id),
  );
  if (rest.length === 0) {
    await setResolveCandidateState({ db, candidateId: candidate.id, state: 'discarded' });
    await loadResolveCandidatesInto({ set, sessionId });
    return captured.splits[0]?.sha ?? null;
  }
  for (const { item } of rest) {
    await insertResolveCandidateItem({
      db,
      item: {
        candidateId: candidate.id,
        queueItemId: item.id,
        itemRevision: item.candidateRevision,
      },
    });
  }
  await recordCommitLinks({
    sessionId,
    worktreePath: candidate.worktreePath,
    baseSha: candidate.baseSha,
    candidateSha: captured.sha,
    threads: rest.map(({ thread }) => thread),
  }).catch(() => undefined);
  await markOverlappingResolveCandidatesStale({ db, candidateId: candidate.id });
  const ready = await markResolveCandidateReady({
    db,
    candidateId: candidate.id,
    candidateSha: captured.sha,
  });
  await loadResolveCandidatesInto({ set, sessionId });
  return ready ? captured.sha : null;
};
