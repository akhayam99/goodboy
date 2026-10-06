import { setResolveAttemptCopyPath } from '@goodboy/db';
import type { ResolveAttempt, ResolveThread } from '@goodboy/types';
import { discardHistoryCopy } from '../../../features/history/historyEngine';
import { tauriDatabase } from '../../../shared/lib/db';
import { keepsResolveCopy } from './keepsResolveCopy';

const LIVE_PHASES: ReadonlyArray<ResolveAttempt['phase']> = ['queued', 'running'];

export const releaseResolveCopy = async ({
  attempt,
  sharing = [attempt],
}: {
  readonly attempt: ResolveAttempt;
  readonly sharing?: ReadonlyArray<ResolveAttempt>;
}): Promise<void> => {
  const copyPath = attempt.copyPath;
  if (copyPath === null) {
    return;
  }
  const worktreePath = attempt.mountTarget?.worktreePath ?? null;
  if (worktreePath !== null) {
    try {
      await discardHistoryCopy({ worktreePath, copyPath });
    } catch {
      return;
    }
  }
  for (const holder of sharing) {
    await setResolveAttemptCopyPath({ db: tauriDatabase, id: holder.id, copyPath: null });
  }
};

export const releaseEndedResolveCopies = async ({
  attempts,
  rows,
}: {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly rows: ReadonlyArray<ResolveThread>;
}): Promise<boolean> => {
  const ended = attempts.filter(
    (attempt) => attempt.copyPath !== null && !LIVE_PHASES.includes(attempt.phase),
  );
  const released = new Set<string>();
  for (const attempt of ended) {
    const copyPath = attempt.copyPath;
    if (copyPath === null || released.has(copyPath)) {
      continue;
    }
    if (keepsResolveCopy({ attempt, attempts, rows })) {
      continue;
    }
    released.add(copyPath);
    await releaseResolveCopy({
      attempt,
      sharing: attempts.filter((item) => item.copyPath === copyPath),
    });
  }
  return released.size > 0;
};
