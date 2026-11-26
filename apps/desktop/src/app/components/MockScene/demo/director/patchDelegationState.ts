import type { AutoDelegation } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import type { DirectorStore } from './directorTypes';
import { patchAutoView } from './patchAutoView';

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly childAgentId: AgentId;
  readonly state: AutoDelegation['state'];
};

export const patchDelegationState = ({ store, sessionId, childAgentId, state }: Params): void => {
  patchAutoView({
    store,
    sessionId,
    patch: ({ view }) => ({
      ...view,
      delegations: view.delegations.map((delegation) =>
        delegation.childAgentId === childAgentId ? { ...delegation, state } : delegation,
      ),
    }),
  });
};
