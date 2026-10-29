import type { AgentId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { pushFailureReason } from '../../../features/resolve/pushFailureReason';
import { identityChange } from './historyIdentity';
import { persistPushFixes } from './pushFix/persistPushFixes';
import { completePushFixOutcome } from './pushFix/completePushFixOutcome';
import { recordPushFixOutcome } from './pushFix/recordPushFixOutcome';
import { pushFailureReportOf } from '../notifications/pushFailureReport';
import type { SliceDeps } from '../../slice-types';
import { WORK_KEPT } from '../notifications/errorRecovery';
import type { PushFixOutcome } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly hasFailed: boolean;
  readonly reason?: string | null;
};

type OutcomeBase = Pick<
  PushFixOutcome,
  'agentId' | 'sessionId' | 'mountId' | 'settledAt' | 'isClaimed' | 'followUp'
>;

export const settleBranchPushFix = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, agentId, hasFailed, reason = null }: Params): Promise<void> => {
    const fix = get().branchPushFixes[agentId];
    if (fix === undefined || fix.sessionId !== sessionId) {
      return;
    }
    const continuation = Object.values(get().pushContinuations).find(
      (candidate) => candidate.agentId === agentId,
    );
    set((state) => ({
      branchPushFixes: Object.fromEntries(
        Object.entries(state.branchPushFixes).filter(([key]) => key !== agentId),
      ),
      pushContinuations: Object.fromEntries(
        Object.entries(state.pushContinuations).filter(
          ([, candidate]) => candidate.agentId !== agentId,
        ),
      ),
    }));
    persistPushFixes({ get });
    const { mountId, identity, isForce, confirmedOnlyOnline, confirmedRemoteSha } = fix;
    const base: OutcomeBase = {
      agentId,
      sessionId,
      mountId,
      settledAt: Date.now(),
      isClaimed: false,
      followUp: null,
    };
    if (hasFailed) {
      recordPushFixOutcome({ set, get, outcome: { ...base, kind: 'agent_failed', reason } });
      return;
    }
    const change = identityChange({ get, sessionId, mountId, identity });
    if (change !== null) {
      recordPushFixOutcome({ set, get, outcome: { ...base, kind: 'push_failed', reason: change } });
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
      recordPushFixOutcome({
        set,
        get,
        outcome: {
          ...base,
          kind: 'push_failed',
          reason: pushFailureReason({ error: result.error }),
        },
      });
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
    recordPushFixOutcome({
      set,
      get,
      outcome: { ...base, kind: 'pushed', reason: null, isClaimed: false },
      isHeld: continuation !== undefined,
    });
    if (continuation === undefined) {
      return;
    }
    try {
      const followUp = await continuation.resume();
      completePushFixOutcome({ set, get })({ mountId, agentId, followUp: followUp ?? null });
    } catch (error) {
      completePushFixOutcome({ set, get })({
        mountId,
        agentId,
        followUp: { tone: 'failed', sentence: formatError(error) },
      });
      await get().reportError({
        title: "Couldn't continue after the fix.",
        error,
        sessionId,
        recovery: WORK_KEPT,
      });
    }
  };
};
