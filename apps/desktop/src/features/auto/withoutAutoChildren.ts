import type { Agent } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly views: ReadonlyArray<AutoTreeView>;
};

export const withoutAutoChildren = ({ agents, views }: Params): ReadonlyArray<Agent> => {
  const children = new Set<string>(
    views.flatMap((view) =>
      view.delegations
        .filter((delegation) => !delegation.isAdopted)
        .map((delegation) => delegation.childAgentId),
    ),
  );
  return children.size === 0 ? agents : agents.filter((agent) => !children.has(agent.id));
};
