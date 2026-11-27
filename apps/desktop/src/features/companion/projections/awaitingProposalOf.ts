import type { AutoDelegation } from '@goodboy/db';
import type { Agent } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { delegationCardOf, type DelegationCardModel } from '../../auto/chat/delegationCardOf';
import { isAutoDelegationReplaced } from '../../auto/isAutoDelegationReplaced';
import { nextActionOf, type NextAction } from '../../auto/chat/nextActionOf';

export type AwaitingProposal = Readonly<{
  view: AutoTreeView;
  delegation: AutoDelegation;
  card: DelegationCardModel;
  action: NextAction;
}>;

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly delegationId: string | null;
};

export const awaitingProposalOf = ({
  views,
  agents,
  delegationId,
}: Params): AwaitingProposal | null => {
  for (const view of views) {
    const delegation = view.delegations.find(
      (candidate) =>
        candidate.state === 'awaiting_confirm' &&
        (delegationId === null || candidate.id === delegationId),
    );
    if (delegation === undefined) {
      continue;
    }
    const childAgent = agents.find((agent) => agent.id === delegation.childAgentId) ?? null;
    const card = delegationCardOf({
      delegation,
      childAgent,
      isReplaced: isAutoDelegationReplaced({ delegation, delegations: view.delegations }),
    });
    return { view, delegation, card, action: nextActionOf({ view, delegation, card }) };
  }
  return null;
};
