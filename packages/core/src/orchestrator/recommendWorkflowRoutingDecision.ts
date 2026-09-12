import type {
  WorkflowRoutingDecision,
  WorkflowRoutingProposal,
  WorkflowTaskProfile,
} from '@goodboy/types';
import { cappedRoutingReason } from './parseWorkflowRoutingProposal';
import { recommendWorkflowModel } from './recommendWorkflowModel';
import { workflowModelCandidates } from './workflowModelCandidates';
import { workflowRecoveryTier } from './workflowRecoveryTier';
import type { WorkflowRoutingAvailabilitySnapshot } from './workflowRoutingAvailability';

type Params = {
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
  readonly profile: WorkflowTaskProfile;
  readonly proposal: WorkflowRoutingProposal | null;
  readonly contextEstimate: number | null;
};

export const recommendWorkflowRoutingDecision = ({
  availability,
  profile,
  proposal,
  contextEstimate,
}: Params): WorkflowRoutingDecision | null => {
  const recommendation = recommendWorkflowModel({
    candidates: workflowModelCandidates({ availability }),
    profile,
    contextEstimate,
    targetTier: workflowRecoveryTier({ pick: null }),
  });
  if (recommendation === null) {
    return null;
  }
  return {
    version: 1,
    proposal,
    selected: recommendation.pick,
    source: 'heuristic',
    reason: cappedRoutingReason(recommendation.reason),
    adjustment: 'none',
    executed: null,
  };
};
