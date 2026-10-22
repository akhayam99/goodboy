import type { AutoDelegation } from '@goodboy/db';
import type { AgentId } from '@goodboy/types';

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly present: ReadonlyArray<AutoDelegation>;
};

export const hiddenChildIdsOf = ({ delegations, present }: Params): ReadonlyArray<AgentId> => {
  const shown = new Set<string>(present.map((delegation) => delegation.childAgentId));
  return [
    ...new Set(
      delegations
        .map((delegation) => delegation.childAgentId)
        .filter((childAgentId) => !shown.has(childAgentId)),
    ),
  ];
};
