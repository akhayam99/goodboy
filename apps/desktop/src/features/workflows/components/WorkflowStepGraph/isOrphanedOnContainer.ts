import type { AgentId, ClusterCompletionHold } from '@goodboy/types';

type Params = {
  readonly hold: ClusterCompletionHold;
  readonly containerAgentId: AgentId;
  readonly visibleAgentIds: ReadonlySet<string>;
};

export const isOrphanedOnContainer = ({
  hold,
  containerAgentId,
  visibleAgentIds,
}: Params): boolean =>
  hold.containerAgentId === containerAgentId && visibleAgentIds.has(hold.sourceAgentId) === false;
