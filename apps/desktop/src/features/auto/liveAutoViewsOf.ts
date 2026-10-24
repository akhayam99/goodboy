import type { Agent } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
};

export const liveAutoViewsOf = ({ views, agents }: Params): ReadonlyArray<AutoTreeView> => {
  const ids = new Set<string>(agents.map((agent) => agent.id));
  const live = views.filter((view) => ids.has(view.tree.rootAgentId));
  return live.length === views.length ? views : live;
};
