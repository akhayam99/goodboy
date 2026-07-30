import type { Agent, AgentId, IsoDateTime } from '@goodboy/types';

type Params = {
  readonly runs: ReadonlyArray<Agent>;
  readonly rootAgentId: AgentId;
  readonly stampedAt: IsoDateTime;
  readonly additionalAgentIds?: ReadonlyArray<AgentId>;
};

type ViewedAgentStamp = {
  readonly agentIds: ReadonlySet<AgentId>;
  readonly runs: ReadonlyArray<Agent>;
};

export const stampAgentSubtreeViewed = ({
  runs,
  rootAgentId,
  stampedAt,
  additionalAgentIds = [],
}: Params): ViewedAgentStamp => {
  const agentIds = new Set<AgentId>([rootAgentId, ...additionalAgentIds]);
  const childrenByParentId = new Map<AgentId, AgentId[]>();
  for (const run of runs) {
    if (run.parentAgentId == null) {
      continue;
    }
    const children = childrenByParentId.get(run.parentAgentId) ?? [];
    children.push(run.id);
    childrenByParentId.set(run.parentAgentId, children);
  }

  const queue: AgentId[] = [rootAgentId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null) {
      continue;
    }
    for (const childId of childrenByParentId.get(current) ?? []) {
      if (agentIds.has(childId)) {
        continue;
      }
      agentIds.add(childId);
      queue.push(childId);
    }
  }

  return {
    agentIds,
    runs: runs.map((run) => (agentIds.has(run.id) ? { ...run, lastViewedAt: stampedAt } : run)),
  };
};
