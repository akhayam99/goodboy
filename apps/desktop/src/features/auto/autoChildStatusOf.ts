import type { Agent } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoTreeOfAgent } from './autoTreeOfAgent';
import { delegationCardOf } from './chat/delegationCardOf';
import type { DelegationStatus } from './chat/settledStatusOf';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView> | undefined;
  readonly agent: Agent;
};

export const autoChildStatusOf = ({ views, agent }: Params): DelegationStatus | null => {
  const tree = autoTreeOfAgent({ views: views ?? [], agentId: agent.id });
  if (tree?.kind !== 'child') {
    return null;
  }
  return delegationCardOf({ delegation: tree.delegation, childAgent: agent }).status;
};
