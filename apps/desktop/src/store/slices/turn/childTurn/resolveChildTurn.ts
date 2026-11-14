import {
  parseAutoDelegationRole,
  storedLaunchGuardOf,
  type AutoDelegationRole,
  type LaunchGuard,
} from '@goodboy/core/auto';
import {
  getLatestAutoDelegationOfChild,
  listAutoAttemptsOfDelegation,
  type AutoDelegation,
} from '@goodboy/db';
import type { AgentId, AutoDelegationId, AutoTreeId, ProviderId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { routedModelOf } from './routedModelOf';

export type ChildTurn = Readonly<{
  delegationId: AutoDelegationId;
  treeId: AutoTreeId;
  role: AutoDelegationRole;
  route: Readonly<{ provider: ProviderId; model: string }>;
  guard: LaunchGuard | null;
}>;

export type ChildTurnResolution =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'child'; child: ChildTurn }>
  | Readonly<{ kind: 'unresolved' }>;

type Params = Readonly<{
  agentId: AgentId;
}>;

type ChildRead = Readonly<{
  isRead: boolean;
  delegation: AutoDelegation | null;
  guard: LaunchGuard | null;
}>;

const NOT_A_CHILD = { kind: 'none' } satisfies ChildTurnResolution;

const UNRESOLVED = { kind: 'unresolved' } satisfies ChildTurnResolution;

const UNREAD: ChildRead = { isRead: false, delegation: null, guard: null };

const readChild = async ({ agentId }: Params): Promise<ChildRead> => {
  const delegation = await getLatestAutoDelegationOfChild({
    db: tauriDatabase,
    childAgentId: agentId,
  });
  if (delegation === null) {
    return { isRead: true, delegation, guard: null };
  }
  const attempts = await listAutoAttemptsOfDelegation({
    db: tauriDatabase,
    delegationId: delegation.id,
  });
  const latest = attempts[attempts.length - 1];
  const guard = latest === undefined ? null : storedLaunchGuardOf({ writeSet: latest.writeSet });
  return { isRead: true, delegation, guard };
};

export const resolveChildTurn = async ({ agentId }: Params): Promise<ChildTurnResolution> => {
  const read = await readChild({ agentId }).catch((): ChildRead => UNREAD);
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
    child: {
      delegationId: read.delegation.id,
      treeId: read.delegation.treeId,
      role,
      route,
      guard: read.guard,
    },
  };
};
