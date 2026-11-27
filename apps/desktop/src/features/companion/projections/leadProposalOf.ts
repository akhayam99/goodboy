import type { LeadProposal } from '../contract/projections';
import { proposalVersionOf } from '../actions/versions';
import { actionIdOf } from './actionIdOf';
import { awaitingProposalOf } from './awaitingProposalOf';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const PROPOSAL_TITLE_MAX = 80;
export const PROPOSAL_TASK_MAX = 240;
export const PROPOSAL_LABEL_MAX = 120;
export const PROPOSAL_ALTERNATIVES_MAX = 2;

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

type ChoiceParams = {
  readonly delegationId: string;
  readonly version: string;
  readonly choice: string;
};

const actionIdOfChoice = ({ delegationId, version, choice }: ChoiceParams): string =>
  actionIdOf({ kind: 'decideProposal', objectId: `${delegationId}.${choice}`, version });

export const leadProposalOf = ({ scope, sessionId }: Params): LeadProposal | null => {
  const found = awaitingProposalOf({
    views: scope.trees[sessionId] ?? [],
    agents: scope.agents[sessionId] ?? [],
    delegationId: null,
  });
  if (found === null) {
    return null;
  }
  const { delegation, card, action } = found;
  const version = proposalVersionOf({ delegation });
  const task = safeTextOf({ text: action.title, max: PROPOSAL_TASK_MAX });
  return {
    delegationId: delegation.id,
    version,
    role: delegation.role,
    title: safeTextOf({ text: card.roleLabel, max: PROPOSAL_TITLE_MAX }),
    ...(task === '' ? {} : { task }),
    options: action.choices.slice(0, 1 + PROPOSAL_ALTERNATIVES_MAX).map((choice) => ({
      key: choice.key,
      label: safeTextOf({ text: choice.label, max: PROPOSAL_LABEL_MAX }),
      role: choice.role,
      actionId: actionIdOfChoice({ delegationId: delegation.id, version, choice: choice.key }),
    })),
    notNowActionId: actionIdOfChoice({ delegationId: delegation.id, version, choice: 'notNow' }),
  };
};
