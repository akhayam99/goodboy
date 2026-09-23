import type { AgentId, CapabilityObligation, ClusterCompletionHold } from '@goodboy/types';
import { isOrphanedOnContainer } from './isOrphanedOnContainer';

type Params = {
  readonly agentId: AgentId;
  readonly visibleAgentIds: ReadonlySet<string>;
  readonly holds: ReadonlyArray<ClusterCompletionHold>;
  readonly obligations: ReadonlyArray<CapabilityObligation>;
};

export const openObligationForNode = ({
  agentId,
  visibleAgentIds,
  holds,
  obligations,
}: Params): CapabilityObligation | null => {
  const open = obligations.filter((obligation) => obligation.state === 'open');
  const direct = open.find((obligation) => obligation.requesterAgentId === agentId);
  if (direct !== undefined) {
    return direct;
  }
  const orphanedHoldIds = new Set(
    holds
      .filter((hold) => isOrphanedOnContainer({ hold, containerAgentId: agentId, visibleAgentIds }))
      .map((hold) => hold.id),
  );
  return (
    open.find(
      (obligation) =>
        visibleAgentIds.has(obligation.requesterAgentId) === false &&
        (obligation.requesterParentAgentId === agentId ||
          obligation.holdIds.some((holdId) => orphanedHoldIds.has(holdId))),
    ) ?? null
  );
};
