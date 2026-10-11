import type { SliceDeps } from '../../slice-types';
import type { HistoryMountInput } from './types';

type DepsParams = SliceDeps;
type Params = HistoryMountInput;

export const resumeHistoryMove = ({ get }: DepsParams) => {
  return async ({ sessionId, mountId }: Params): Promise<void> => {
    const run = get().historyRuns[mountId];
    if (run?.phase !== 'choosing' || run.sessionId !== sessionId || run.pendingMove === undefined) {
      return;
    }
    const pending = run.pendingMove;
    if (pending.kind === 'apply') {
      await get().applyHistoryRewrite({ ...pending.input, shouldStash: true });
      return;
    }
    await get().restoreHistory({ ...pending.input, shouldStash: true });
  };
};
