import type { MountId, SessionId } from '@goodboy/types';
import { listCleanupProposals, settleCleanupProposal } from '../mount-cleanup/cleanupProposals';
import type { SetFn } from './types';

type SettleParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly outcome: 'removed' | 'kept';
};

export const settleMountCleanupProposals = async ({
  set,
  sessionId,
  mountId,
  outcome,
}: SettleParams): Promise<void> => {
  const proposals = await listCleanupProposals({ sessionId });
  const owned = proposals.filter((proposal) => proposal.mountId === mountId);
  if (owned.length === 0) {
    return;
  }
  for (const proposal of owned) {
    await settleCleanupProposal({
      sessionId,
      requestId: proposal.requestId,
      outcome,
      detail: 'the mount left the session',
    });
  }
  const settled = new Set(owned.map((proposal) => proposal.requestId));
  set((state) => ({
    mountCleanupProposals: {
      ...state.mountCleanupProposals,
      [sessionId]: (state.mountCleanupProposals[sessionId] ?? []).filter(
        (candidate) => !settled.has(candidate.requestId),
      ),
    },
  }));
};
