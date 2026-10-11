import { applyHistoryPlan } from '../../../features/history/historyEngine';
import type { SliceDeps } from '../../slice-types';
import { identityChange } from './historyIdentity';
import { setHistoryRun } from './setHistoryRun';
import { shouldHandleLateOutcome } from './shouldHandleLateOutcome';
import type { HistoryMountInput } from './types';

type DepsParams = SliceDeps;
type Params = HistoryMountInput;

export const bringBackHistoryFiles = ({ set, get }: DepsParams) => {
  return async ({ sessionId, mountId }: Params): Promise<void> => {
    const run = get().historyRuns[mountId];
    const saved = run?.savedStash;
    if (run?.phase !== 'set-aside' || run.sessionId !== sessionId || saved === undefined) {
      return;
    }
    const changed = identityChange({ get, sessionId, mountId, identity: saved.identity });
    if (changed !== null) {
      throw new Error(changed);
    }
    const outcome = await applyHistoryPlan({
      worktreePath: saved.identity.worktreePath,
      branch: saved.identity.branch,
      expectedHead: saved.expectedHead,
      newHead: saved.expectedHead,
      restoreStash: saved.sha,
    });
    const isLate =
      get().historyRuns[mountId] !== run ||
      identityChange({ get, sessionId, mountId, identity: saved.identity }) !== null;
    const isRunDismissed = get().historyRuns[mountId] === undefined;
    if (isLate && !shouldHandleLateOutcome({ outcome, isRunDismissed })) {
      return;
    }
    if (outcome.kind === 'files-restored') {
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin: run.origin,
        patch: { phase: 'restored', savedStash: undefined, stop: null },
      });
      if (outcome.cleanupError !== undefined) {
        await get().reportError({
          title: 'Your files are back, but stash cleanup needs attention',
          error: outcome.cleanupError,
          severity: 'warning',
          sessionId,
        });
      }
      return;
    }
    if (outcome.kind === 'restore-conflict') {
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin: run.origin,
        patch: { phase: 'restore-conflict', savedStash: { ...saved, files: outcome.files } },
      });
      return;
    }
    if (outcome.kind === 'blocked') {
      throw new Error(outcome.reason);
    }
    throw new Error("Couldn't bring your files back. They remain saved in the stash.");
  };
};
