import type { AutoDelegation } from '@goodboy/db';
import type { AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

type AutoAdoption = Readonly<{
  view: AutoTreeView;
  delegation: AutoDelegation;
  autoAgentId: AgentId;
}>;

export type AutoMembership = Readonly<{
  isMember: boolean;
  adoption: AutoAdoption | null;
}>;

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agentId: AgentId;
};

const NO_AUTO_MEMBERSHIP: AutoMembership = { isMember: false, adoption: null };

export const autoMembershipOf = ({ views, agentId }: Params): AutoMembership => {
  let isMember = false;
  for (const view of views) {
    if (view.tree.rootAgentId === agentId) {
      isMember = true;
    }
    const delegation = view.delegations.find((candidate) => candidate.childAgentId === agentId);
    if (delegation === undefined) {
      continue;
    }
    isMember = true;
    if (delegation.isAdopted) {
      return {
        isMember: true,
        adoption: { view, delegation, autoAgentId: view.tree.rootAgentId },
      };
    }
  }
  return isMember ? { isMember: true, adoption: null } : NO_AUTO_MEMBERSHIP;
};
