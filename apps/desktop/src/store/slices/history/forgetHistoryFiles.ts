import { forgetSavedFiles } from '../../../features/history/historyEngine';
import type { SliceDeps } from '../../slice-types';
import { identityChange } from './historyIdentity';
import type { HistoryMountInput } from './types';

type DepsParams = SliceDeps;
type Params = HistoryMountInput;

export const forgetHistoryFiles = ({ set, get }: DepsParams) => {
  return async ({ sessionId, mountId }: Params): Promise<void> => {
    const run = get().historyRuns[mountId];
    const saved = run?.savedStash;
    if (
      (run?.phase !== 'set-aside' && run?.phase !== 'restore-conflict') ||
      run.sessionId !== sessionId ||
      saved === undefined
    ) {
      return;
    }
    const changed = identityChange({ get, sessionId, mountId, identity: saved.identity });
    if (changed !== null) {
      throw new Error(changed);
    }
    const outcome = await forgetSavedFiles({
      worktreePath: saved.identity.worktreePath,
      branch: saved.identity.branch,
      expectedHead: saved.expectedHead,
      stash: saved.sha,
    });
    if (outcome.kind === 'blocked') {
      throw new Error(outcome.reason);
    }
    if (get().historyRuns[mountId] !== run) {
      return;
    }
    get().dismissHistoryRun({ sessionId, mountId });
  };
};
