import { collectHistoryRewrite, discardHistoryCopy } from '../../../features/history/historyEngine';
import type { SliceDeps } from '../../slice-types';
import type { HistoryMountInput } from './types';

type Params = HistoryMountInput;

export const acceptHistoryChange = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, mountId }: Params): Promise<void> => {
    const run = get().historyRuns[mountId];
    const agentId = run?.agentId ?? null;
    const review = run?.stop?.review;
    const binding =
      agentId === null || agentId === undefined ? undefined : get().historyRewriters[agentId];
    if (
      agentId === null ||
      run === undefined ||
      run.sessionId !== sessionId ||
      run.phase !== 'stopped' ||
      run.stop?.reason !== 'invalid' ||
      review === null ||
      review === undefined ||
      binding === undefined ||
      binding.mountId !== mountId ||
      binding.sessionId !== sessionId
    ) {
      return;
    }
    const check = await collectHistoryRewrite({
      plan: binding.plan,
      copyPath: binding.copyPath,
      skipped: [],
      keepsCopy: true,
      reviewedHead: review.copyHead,
    });
    if (get().historyRuns[mountId] !== run || get().historyRewriters[agentId] !== binding) {
      return;
    }
    if (check.head === null) {
      throw new Error(check.problems.join(' '));
    }
    const outcome = await get().applyHistoryRewrite({
      sessionId,
      mountId,
      origin: run.origin,
      planId: run.planId,
      newHead: check.head,
      expectedHead: binding.plan.head,
      map: check.map,
      shouldPush: false,
      byAgent: true,
      identity: binding.identity,
      isTreeEqual: check.isTreeEqual,
    });
    if (outcome !== 'applied' && outcome !== 'pushed') {
      return;
    }
    await discardHistoryCopy({
      worktreePath: binding.identity.worktreePath,
      copyPath: binding.copyPath,
    });
    set((state) => {
      if (state.historyRewriters[agentId] !== binding) {
        return {};
      }
      const { [agentId]: _dropped, ...historyRewriters } = state.historyRewriters;
      const applied = state.historyRuns[mountId];
      return {
        historyRewriters,
        ...(applied?.copyPath === binding.copyPath
          ? {
              historyRuns: { ...state.historyRuns, [mountId]: { ...applied, copyPath: null } },
            }
          : {}),
      };
    });
  };
};
