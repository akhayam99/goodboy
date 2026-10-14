import type { AutoDelegation } from '@goodboy/db';
import type { AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

export type AutoTreeOfAgent =
  | Readonly<{ kind: 'root'; view: AutoTreeView }>
  | Readonly<{ kind: 'child'; view: AutoTreeView; delegation: AutoDelegation }>;

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agentId: AgentId;
};

export const autoTreeOfAgent = ({ views, agentId }: Params): AutoTreeOfAgent | null => {
  for (const view of views) {
    if (view.tree.rootAgentId === agentId) {
      return { kind: 'root', view };
    }
    const delegation = [...view.delegations]
      .reverse()
      .find((candidate) => candidate.childAgentId === agentId && !candidate.isAdopted);
    if (delegation !== undefined) {
      return { kind: 'child', view, delegation };
    }
  }
  return null;
};
