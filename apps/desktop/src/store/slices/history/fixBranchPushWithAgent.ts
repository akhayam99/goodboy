import { branchPushLease } from '../../../features/history/branchPushLease';
import { pushFixBrief } from '../../../features/history/pushFixBrief';
import { pushFixCommand } from '../../../features/history/pushFixCommand';
import { identityChange, identityOf } from './historyIdentity';
import { historyTargetOf } from './historyTargetOf';
import { spawnPushFixer } from './spawnPushFixer';
import { pushFixInFlight } from './pushFixInFlight';
import { persistPushFixes } from './pushFix/persistPushFixes';
import { pushFixStateOf } from './pushFix/pushFixStateOf';
import type { SliceDeps } from '../../slice-types';
import type { BranchPushInput, PushContinuation } from './types';

type Params = BranchPushInput & {
  readonly message: string;
  readonly hint?: string;
  readonly pending?: string;
  readonly onAccepted?: () => void;
  readonly onSettled?: PushContinuation['resume'];
};

export const fixBranchPushWithAgent = ({ set, get }: SliceDeps) => {
  return async ({
    sessionId,
    mountId,
    isForce,
    confirmedOnlyOnline,
    confirmedRemoteSha,
    message,
    hint,
    pending,
    onAccepted,
    onSettled,
  }: Params): Promise<void> => {
    const current = pushFixStateOf({
      fixes: get().branchPushFixes,
      outcomes: get().pushFixOutcomes,
      agents: get().sessionPhaseRuns[sessionId],
      sessionId,
      mountId,
    });
    if (current.kind === 'working') {
      return;
    }
    const key = `branch:${mountId}`;
    if (!pushFixInFlight.claim({ key })) {
      return;
    }
    try {
      const target = historyTargetOf({ get, sessionId, mountId });
      const remoteSha = await branchPushLease({
        isForce,
        branch: target.branch,
        worktreePath: target.worktreePath,
        workspaceId: target.workspaceId,
        projectId: target.projectId,
        confirmedOnlyOnline,
        confirmedRemoteSha,
      });
      const identity = identityOf({ target });
      if (identityChange({ get, sessionId, mountId, identity }) !== null) {
        return;
      }
      await spawnPushFixer({
        get,
        sessionId,
        mountId,
        prompt: pushFixBrief({
          branch: target.branch,
          command: pushFixCommand({ branch: target.branch, remoteSha }),
          output: message,
          ...(hint !== undefined && { hint }),
          ...(pending !== undefined && { pending }),
        }),
        ...(onAccepted !== undefined && { onAccepted }),
        isStillValid: () => identityChange({ get, sessionId, mountId, identity }) === null,
        bind: ({ agentId }) => {
          set((state) => ({
            branchPushFixes: {
              ...Object.fromEntries(
                Object.entries(state.branchPushFixes).filter(
                  ([, fix]) => fix.sessionId !== sessionId || fix.mountId !== mountId,
                ),
              ),
              [agentId]: {
                agentId,
                sessionId,
                mountId,
                identity,
                isForce,
                confirmedOnlyOnline,
                confirmedRemoteSha,
                startedAt: Date.now(),
              },
            },
            pushFixOutcomes: Object.fromEntries(
              Object.entries(state.pushFixOutcomes).filter(([key]) => key !== mountId),
            ),
            pushContinuations:
              onSettled === undefined
                ? state.pushContinuations
                : {
                    ...state.pushContinuations,
                    [mountId]: { agentId, sessionId, mountId, resume: onSettled },
                  },
          }));
          persistPushFixes({ get });
        },
        unbind: ({ agentId }) => {
          set((state) => ({
            branchPushFixes: Object.fromEntries(
              Object.entries(state.branchPushFixes).filter(([key]) => key !== agentId),
            ),
            pushContinuations: Object.fromEntries(
              Object.entries(state.pushContinuations).filter(
                ([, continuation]) => continuation.agentId !== agentId,
              ),
            ),
          }));
          persistPushFixes({ get });
        },
      });
    } finally {
      pushFixInFlight.release({ key });
    }
  };
};
