import type { AutoDelegation, AutoTree } from '@goodboy/db';
import type { AgentStatus } from '@goodboy/types';
import { textFieldOf } from '../../../shared/utils/textFieldOf';

const LIVE_AGENT_STATUSES: ReadonlyArray<AgentStatus> = ['pending', 'running', 'blocked'];

const ENDED_TREE_PHASES: ReadonlyArray<AutoTree['phase']> = ['finished', 'stopping', 'stopped'];

type AgentFact = {
  readonly status: AgentStatus;
  readonly mountId?: string;
};

type TreeFact = {
  readonly tree: Pick<AutoTree, 'phase' | 'stopState' | 'primaryMountId'>;
  readonly delegations: ReadonlyArray<Pick<AutoDelegation, 'target'>>;
};

type Params = {
  readonly agents: ReadonlyArray<AgentFact>;
  readonly trees: ReadonlyArray<TreeFact>;
};

export const mountsInUseOf = ({ agents, trees }: Params): ReadonlySet<string> => {
  const inUse = new Set<string>();
  for (const agent of agents) {
    if (agent.mountId !== undefined && LIVE_AGENT_STATUSES.includes(agent.status)) {
      inUse.add(agent.mountId);
    }
  }
  for (const { tree, delegations } of trees) {
    if (tree.stopState !== 'none' || ENDED_TREE_PHASES.includes(tree.phase)) {
      continue;
    }
    if (tree.primaryMountId !== null) {
      inUse.add(tree.primaryMountId);
    }
    for (const delegation of delegations) {
      const mountId = textFieldOf({ source: delegation.target, key: 'mountId' });
      if (mountId !== null) {
        inUse.add(mountId);
      }
    }
  }
  return inUse;
};
