import { parseAutoDelegationRole, type AutoDelegationRole } from '@goodboy/core/auto';
import { getLatestAutoDelegationOfChild, type AutoDelegation } from '@goodboy/db';
import type { AgentId, AutoDelegationId, AutoTreeId, ProviderId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { routedModelOf } from './routedModelOf';

export type ChildTurn = Readonly<{
  delegationId: AutoDelegationId;
  treeId: AutoTreeId;
  role: AutoDelegationRole;
  route: Readonly<{ provider: ProviderId; model: string }>;
}>;

export type ChildTurnResolution =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'child'; child: ChildTurn }>
  | Readonly<{ kind: 'unresolved' }>;

type Params = Readonly<{
  agentId: AgentId;
}>;

type DelegationRead = Readonly<{
  isRead: boolean;
  delegation: AutoDelegation | null;
}>;

const NOT_A_CHILD = { kind: 'none' } satisfies ChildTurnResolution;

const UNRESOLVED = { kind: 'unresolved' } satisfies ChildTurnResolution;

const UNREAD: DelegationRead = { isRead: false, delegation: null };

export const resolveChildTurn = async ({ agentId }: Params): Promise<ChildTurnResolution> => {
  const read = await getLatestAutoDelegationOfChild({
    db: tauriDatabase,
    childAgentId: agentId,
  }).then(
    (delegation): DelegationRead => ({ isRead: true, delegation }),
    () => UNREAD,
  );
  if (!read.isRead) {
    return UNRESOLVED;
  }
  if (read.delegation === null) {
    return NOT_A_CHILD;
  }
  const role = parseAutoDelegationRole({ role: read.delegation.role });
  const route = routedModelOf({ delegation: read.delegation }).routedModel;
  if (role === null || route === undefined) {
    return UNRESOLVED;
  }
  return {
    kind: 'child',
    child: { delegationId: read.delegation.id, treeId: read.delegation.treeId, role, route },
  };
};
