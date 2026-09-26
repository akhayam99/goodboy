import {
  listResolveCandidateItems,
  listResolveCandidates,
  listResolveQueueItems,
} from '@goodboy/db';
import type { ResolveThread, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { remapIntegratedCommits } from './remapIntegratedCommits';

export const reconcileIntegratedCommits = async ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): Promise<void> => {
  const db = tauriDatabase;
  const picked = (await listResolveCandidates({ db, sessionId })).filter(
    (candidate) =>
      candidate.state === 'integrated' &&
      candidate.integratedSha !== null &&
      candidate.integratedSha !== candidate.candidateSha,
  );
  if (picked.length === 0) {
    return;
  }
  const entries = await listResolveQueueItems({ db, sessionId });
  for (const candidate of picked) {
    const members = await listResolveCandidateItems({ db, candidateId: candidate.id });
    const threads: ReadonlyArray<ResolveThread> = members.flatMap((member) => {
      const entry = entries.find((item) => item.item.id === member.queueItemId);
      return entry === undefined || entry.item.deliveredAt !== null ? [] : [entry.thread];
    });
    if (threads.length === 0 || candidate.integratedSha === null) {
      continue;
    }
    await remapIntegratedCommits({
      sessionId,
      worktreePath: candidate.worktreePath,
      baseSha: candidate.baseSha,
      candidateSha: candidate.candidateSha,
      integratedSha: candidate.integratedSha,
      threads,
    });
  }
};
