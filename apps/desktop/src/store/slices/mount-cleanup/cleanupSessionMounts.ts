import type { MountCleanupDecision } from '@goodboy/types';
import { loadMountViews } from '../project-mounts/mountViews';
import { saveCleanupProposal } from './cleanupProposals';
import { buildCleanupProposal, publishCleanupProposal } from './proposeMountCleanup';
import type { CleanupSessionMountsInput, GetFn, SessionCleanupOutcome, SetFn } from './types';

const KEPT_REASON = 'directory kept on request';

export const cleanupSessionMounts = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    reason,
  }: CleanupSessionMountsInput): Promise<ReadonlyArray<SessionCleanupOutcome>> => {
    const views = await loadMountViews({ get, sessionId });
    const outcomes: Array<SessionCleanupOutcome> = [];
    for (const view of views) {
      const worktreePath = view.worktreePath;
      if (worktreePath === null) {
        continue;
      }
      const proposal = await buildCleanupProposal({ get, view, reason, request: null });
      if (proposal !== null && (await saveCleanupProposal({ proposal }))) {
        publishCleanupProposal({ set, sessionId, proposal });
      }
      const decision: MountCleanupDecision = {
        kind: 'kept',
        path: worktreePath,
        reason: KEPT_REASON,
      };
      outcomes.push({ mountId: view.id, worktreePath, decision });
    }
    return outcomes;
  };
};
