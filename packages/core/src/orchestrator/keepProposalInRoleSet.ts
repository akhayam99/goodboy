import type { WorkflowRoutingProposalParseOutcome } from './parseWorkflowRoutingProposal';
import type { OrchestratorModelOption } from './types';

type Params = {
  readonly outcome: WorkflowRoutingProposalParseOutcome;
  readonly setMenu: ReadonlyArray<OrchestratorModelOption> | null;
};

export const keepProposalInRoleSet = ({
  outcome,
  setMenu,
}: Params): WorkflowRoutingProposalParseOutcome => {
  if (outcome.kind !== 'valid' || setMenu === null) {
    return outcome;
  }
  const { pick, profile } = outcome.proposal;
  const isInSet = setMenu.some(
    (option) => option.provider === pick.provider && option.model === pick.model,
  );
  if (isInSet) {
    return outcome;
  }
  return { kind: 'missing', profile };
};
