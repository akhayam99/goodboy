import {
  getResolveCandidate,
  insertResolveCandidateItem,
  listResolveAttempts,
  listResolveQueueItems,
  markOverlappingResolveCandidatesStale,
  markResolveCandidateReady,
  setResolveCandidateState,
} from '@goodboy/db';
import { quarantineWorktreeCandidate } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { withCandidateLock } from './candidateLock';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import { recordCommitLinks } from './recordCommitLinks';
import { ResolveFailure } from './resolveFailure';
import type { CandidateCaptureParams, SliceParams } from './types';

type Params = SliceParams & CandidateCaptureParams;

export const captureResolveCandidate = async ({
  set,
  sessionId,
  attemptId,
  threadIds,
}: Params): Promise<string | null> => {
  const db = tauriDatabase;
  const candidate = await getResolveCandidate({ db, candidateId: attemptId });
  if (candidate === null) {
    const attempt = (await listResolveAttempts({ db, sessionId })).find(
      (item) => item.id === attemptId,
    );
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
  const discard = async (): Promise<null> => {
    await setResolveCandidateState({ db, candidateId: candidate.id, state: 'discarded' });
    await loadResolveCandidatesInto({ set, sessionId });
    return null;
  };
  if (covered.length === 0) {
    return discard();
  }
  const copyPath =
    (await listResolveAttempts({ db, sessionId })).find((attempt) => attempt.id === attemptId)
      ?.copyPath ?? null;
  const capturePath = copyPath ?? candidate.worktreePath;
  const quarantined = await withCandidateLock({
    worktreePath: capturePath,
    holder: `candidate:${candidate.id}`,
    run: () =>
      quarantineWorktreeCandidate({
        worktreePath: capturePath,
        candidateId: candidate.id,
        baseSha: candidate.baseSha,
      }),
  });
  if (quarantined.sha === null) {
    return discard();
  }
  for (const { item } of covered) {
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
    candidateSha: quarantined.sha,
    threads: covered.map(({ thread }) => thread),
  }).catch(() => undefined);
  await markOverlappingResolveCandidatesStale({ db, candidateId: candidate.id });
  const ready = await markResolveCandidateReady({
    db,
    candidateId: candidate.id,
    candidateSha: quarantined.sha,
  });
  await loadResolveCandidatesInto({ set, sessionId });
  return ready ? quarantined.sha : null;
};
