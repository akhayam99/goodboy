import type { AgentId, SessionId } from '@goodboy/types';
import { identityChange } from './historyIdentity';
import { pushFailureReportOf } from '../notifications/pushFailureReport';
import type { SliceDeps } from '../../slice-types';
import { WORK_KEPT } from '../notifications/errorRecovery';

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
      await get().reportError({
        title: "Couldn't push the fix.",
        error: change,
        sessionId,
        recovery: WORK_KEPT,
      });
      return;
    }
    const result = await get().pushBranch(
      isForce
        ? {
            sessionId,
            mountId,
            mode: 'lease',
            guard: { kind: 'confirmed', confirmedOnlyOnline, confirmedRemoteSha },
          }
        : { sessionId, mountId, mode: 'plain', expectedWorktreePath: identity.worktreePath },
    );
    if (!result.ok) {
      await get().reportError({
        title: "Couldn't push the fix.",
        error: result.error,
        ...pushFailureReportOf({ sessionId, mountId, isRetryable: !isForce }),
      });
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
