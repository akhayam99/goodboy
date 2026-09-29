import { setResolveAttemptCopyPath } from '@goodboy/db';
import type { ResolveAttempt } from '@goodboy/types';
import { discardHistoryCopy } from '../../../features/history/historyEngine';
import { tauriDatabase } from '../../../shared/lib/db';

const LIVE_PHASES: ReadonlyArray<ResolveAttempt['phase']> = ['queued', 'running'];

export const releaseResolveCopy = async ({
  attempt,
}: {
  readonly attempt: ResolveAttempt;
}): Promise<void> => {
  const copyPath = attempt.copyPath;
  if (copyPath === null) {
    return;
  }
  const worktreePath = attempt.mountTarget?.worktreePath ?? null;
  if (worktreePath !== null) {
    await discardHistoryCopy({ worktreePath, copyPath }).catch(() => undefined);
  }
  await setResolveAttemptCopyPath({ db: tauriDatabase, id: attempt.id, copyPath: null });
};

export const releaseEndedResolveCopies = async ({
  attempts,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
}): Promise<boolean> => {
  const ended = attempts.filter(
    (attempt) => attempt.copyPath !== null && !LIVE_PHASES.includes(attempt.phase),
  );
  for (const attempt of ended) {
    await releaseResolveCopy({ attempt });
  }
  return ended.length > 0;
};
