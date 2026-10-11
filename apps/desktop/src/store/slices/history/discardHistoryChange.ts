import { discardHistoryCopy } from '../../../features/history/historyEngine';
import type { SliceDeps } from '../../slice-types';
import type { HistoryMountInput } from './types';

type Params = HistoryMountInput;

export const discardHistoryChange = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, mountId }: Params): Promise<void> => {
    const run = get().historyRuns[mountId];
    const agentId = run?.agentId ?? null;
    const binding =
      agentId === null || agentId === undefined ? undefined : get().historyRewriters[agentId];
    if (
      agentId === null ||
      run === undefined ||
      run.sessionId !== sessionId ||
      run.phase !== 'stopped' ||
      run.stop?.reason !== 'invalid' ||
      binding === undefined ||
      binding.mountId !== mountId ||
      binding.sessionId !== sessionId
    ) {
      return;
    }
    const stop = run.stop;
    await discardHistoryCopy({
      worktreePath: binding.identity.worktreePath,
      copyPath: binding.copyPath,
    });
    set((state) => {
      if (state.historyRewriters[agentId] !== binding) {
        return {};
      }
      const { [agentId]: _dropped, ...historyRewriters } = state.historyRewriters;
      return {
        historyRewriters,
        ...(state.historyRuns[mountId] === run
          ? {
              historyRuns: {
                ...state.historyRuns,
                [mountId]: { ...run, copyPath: null, stop: { ...stop, review: null } },
              },
            }
          : {}),
      };
    });
  };
};
