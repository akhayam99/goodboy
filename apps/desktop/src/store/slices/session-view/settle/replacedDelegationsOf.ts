import type { AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../auto-view/state';
import { isAutoDelegationReplaced } from '../../../../features/auto/isAutoDelegationReplaced';

type ReplacedParams = {
  readonly views: ReadonlyArray<AutoTreeView>;
};

export const replacedDelegationsOf = ({
  views,
}: ReplacedParams): ReadonlyArray<{ agentId: AgentId; isReplaced: boolean }> =>
  views.flatMap((view) =>
    view.delegations.map((delegation) => ({
      agentId: delegation.childAgentId,
      isReplaced: isAutoDelegationReplaced({ delegation, delegations: view.delegations }),
    })),
  );
