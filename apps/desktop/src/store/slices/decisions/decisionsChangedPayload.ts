import { countDecisionChanges, hasVisibleDecisionChange, type DecisionChange } from '@goodboy/core';
import type { AgentId, SessionEventPayload } from '@goodboy/types';

type Params = {
  readonly changes: ReadonlyArray<DecisionChange>;
  readonly consolidatedAfter?: string;
  readonly agentId?: AgentId;
};

export const decisionsChangedPayload = ({
  changes,
  consolidatedAfter,
  agentId,
}: Params): SessionEventPayload | null => {
  if (!hasVisibleDecisionChange({ changes })) {
    return null;
  }
  const counts = countDecisionChanges({ changes });
  return {
    added: counts.added,
    replaced: counts.replaced,
    withdrawn: counts.withdrawn,
    merged: counts.merged,
    restored: counts.restored,
    decisionChanges: changes.filter((change) => change.kind !== 'reworded'),
    ...(consolidatedAfter !== undefined && { consolidatedAfter }),
    ...(agentId !== undefined && { agentId }),
  };
};
