import type { AutoDelegation } from '@goodboy/db';
import type { AgentId } from '@goodboy/types';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly goneChildIds: ReadonlySet<AgentId>;
};

type DelegationParams = {
  readonly delegation: AutoDelegation;
};

const mountIdOf = ({ delegation }: DelegationParams): string | null => {
  const value = delegation.target.mountId;
  return typeof value === 'string' && value !== '' ? value : null;
};

type LineParams = DelegationParams & {
  readonly gone: AutoDelegation;
};

const isEarlierInLine = ({ delegation, gone }: LineParams): boolean => {
  if (delegation.id === gone.id) {
    return false;
  }
  if (gone.retryOf === delegation.id) {
    return true;
  }
  if (delegation.state !== 'settled' || delegation.outcome === 'completed') {
    return false;
  }
  const mountId = mountIdOf({ delegation });
  return (
    mountId !== null &&
    !gone.isAdopted &&
    gone.role === delegation.role &&
    gone.createdAt > delegation.createdAt &&
    mountIdOf({ delegation: gone }) === mountId
  );
};

export const presentDelegationsOf = ({
  delegations,
  goneChildIds,
}: Params): ReadonlyArray<AutoDelegation> => {
  if (goneChildIds.size === 0) {
    return delegations;
  }
  const dropped = new Set<string>();
  let frontier = delegations.filter((delegation) => goneChildIds.has(delegation.childAgentId));
  while (frontier.length > 0) {
    for (const delegation of frontier) {
      dropped.add(delegation.id);
    }
    const reached = frontier;
    frontier = delegations.filter(
      (delegation) =>
        !dropped.has(delegation.id) &&
        reached.some((gone) => isEarlierInLine({ delegation, gone })),
    );
  }
  return delegations.filter((delegation) => !dropped.has(delegation.id));
};
