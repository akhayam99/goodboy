import type { Agent } from '@goodboy/types';
import { descendantAgentsOf } from '../session/descendantAgentsOf';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const commentRunAgentsOf = ({ agents }: Params): ReadonlyArray<Agent> => {
  const roots = agents.filter(
    (agent) => agent.deletedAt == null && agent.sourceKind === 'comment_run',
  );
  if (roots.length === 0) {
    return NO_AGENTS;
  }
  return roots.flatMap((root) => [root, ...descendantAgentsOf({ agents, rootId: root.id })]);
};
