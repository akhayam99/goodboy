import type { AgentId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { identityChange } from './historyIdentity';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly hasFailed: boolean;
};

export const settleBranchPushFix = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, agentId, hasFailed }: Params): Promise<void> => {
    const fix = get().branchPushFixes[agentId];
    if (fix === undefined || fix.sessionId !== sessionId) {
      return;
    }
    set((state) => ({
      branchPushFixes: Object.fromEntries(
        Object.entries(state.branchPushFixes).filter(([key]) => key !== agentId),
      ),
    }));
    if (hasFailed) {
      return;
    }
    const { mountId, identity, isForce, confirmedOnlyOnline, confirmedRemoteSha } = fix;
    const change = identityChange({ get, sessionId, mountId, identity });
    if (change !== null) {
      await get().reportError({ title: "Couldn't push the fix.", error: change, sessionId });
      return;
    }
    const result = isForce
      ? await get().forcePushSessionBranch({
          sessionId,
          mountId,
          confirmedOnlyOnline,
          confirmedRemoteSha,
        })
      : await get().pushSessionBranch({
          sessionId,
          mountId,
          expectedWorktreePath: identity.worktreePath,
        });
    if (!result.ok) {
      await get().reportError({ title: "Couldn't push the fix.", error: result.error, sessionId });
      return;
    }
    set((state) => ({
      settledBranchPushes: {
        ...state.settledBranchPushes,
        [mountId]: (state.settledBranchPushes[mountId] ?? 0) + 1,
      },
    }));
  };
};
