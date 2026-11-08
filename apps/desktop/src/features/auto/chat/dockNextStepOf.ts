import type { Agent } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isAutoDelegationReplaced } from '../isAutoDelegationReplaced';
import { delegationCardOf } from './delegationCardOf';
import { nextActionOf, type NextAction } from './nextActionOf';

type Params = {
  readonly view: AutoTreeView;
  readonly agents: ReadonlyArray<Agent>;
  readonly untold: Readonly<Record<string, string>>;
};

export type DockNextStep = Readonly<{
  action: NextAction;
  reviseOf: string | null;
}>;

export const dockNextStepOf = ({ view, agents, untold }: Params): DockNextStep | null => {
  const delegation = view.delegations.find(
    (candidate) => candidate.state === 'awaiting_confirm' || untold[candidate.id] !== undefined,
  );
  if (delegation === undefined) {
    return null;
  }
  const childAgent = agents.find((agent) => agent.id === delegation.childAgentId) ?? null;
  const card = delegationCardOf({
    delegation,
    childAgent,
    isReplaced: isAutoDelegationReplaced({ delegation, delegations: view.delegations }),
  });
  return {
    action: nextActionOf({ view, delegation, card }),
    reviseOf: delegation.reviseOf,
  };
};
