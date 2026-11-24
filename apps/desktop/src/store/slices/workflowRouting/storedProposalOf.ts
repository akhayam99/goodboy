import type {
  WorkflowRoutingDecision,
  WorkflowRoutingProposal,
  WorkflowTaskProfile,
} from '@goodboy/types';

const UNKNOWN_PROFILE: WorkflowTaskProfile = {
  taskType: 'general',
  difficulty: 'unknown',
  basis: 'unknown',
};

type Params = {
  readonly decision: WorkflowRoutingDecision | null;
  readonly profile: WorkflowTaskProfile | null;
};

export const storedProposalOf = ({ decision, profile }: Params): WorkflowRoutingProposal | null => {
  if (decision === null) {
    return null;
  }
  return (
    decision.proposal ?? {
      pick: decision.selected,
      reason: decision.reason,
      source: 'heuristic',
      profile: profile ?? UNKNOWN_PROFILE,
    }
  );
};
