import { branchPushLease } from '../../../features/history/branchPushLease';
import { pushFixBrief } from '../../../features/history/pushFixBrief';
import { pushFixCommand } from '../../../features/history/pushFixCommand';
import { identityChange, identityOf } from './historyIdentity';
import { historyTargetOf } from './historyTargetOf';
import { spawnPushFixer } from './spawnPushFixer';
import { pushFixInFlight } from './pushFixInFlight';
import type { SliceDeps } from '../../slice-types';
import type { BranchPushInput } from './types';

type Params = BranchPushInput & {
  readonly message: string;
  readonly hint?: string;
  readonly pending?: string;
  readonly onAccepted?: () => void;
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
  }: Params): Promise<void> => {
    const isBusy = Object.values(get().branchPushFixes).some(
      (fix) => fix.sessionId === sessionId && fix.mountId === mountId,
    );
    if (isBusy) {
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
          set((current) => ({
            branchPushFixes: {
              ...current.branchPushFixes,
              [agentId]: {
                agentId,
                sessionId,
                mountId,
                identity,
                isForce,
                confirmedOnlyOnline,
                confirmedRemoteSha,
              },
            },
          }));
        },
        unbind: ({ agentId }) => {
          set((current) => ({
            branchPushFixes: Object.fromEntries(
              Object.entries(current.branchPushFixes).filter(([key]) => key !== agentId),
            ),
          }));
        },
      });
    } finally {
      pushFixInFlight.release({ key });
    }
  };
};
