import {
  resolveWorkflowRouting,
  workflowRoutingAvailability,
  type WorkflowRoutingAvailabilitySnapshot,
} from '@goodboy/core';
import type { Step, WorkflowRoutingDecision, WorkflowTaskProfile } from '@goodboy/types';

const UNKNOWN_PROFILE: WorkflowTaskProfile = {
  taskType: 'general',
  difficulty: 'unknown',
  basis: 'unknown',
};

type Params = {
  readonly step: Step;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
};

type RevalidatedStepRouting = Readonly<{
  step: Step;
  decision: WorkflowRoutingDecision;
}>;

export const revalidateStepRouting = ({
  step,
  availability,
}: Params): RevalidatedStepRouting | null => {
  const decision = step.routingDecision ?? null;
  if (decision === null) {
    return null;
  }
  if (step.routingLock != null) {
    return null;
  }
  const status = workflowRoutingAvailability({ pick: decision.selected, snapshot: availability });
  if (status.kind === 'available') {
    return null;
  }
  const profile = step.taskProfile ?? UNKNOWN_PROFILE;
  const proposal = decision.proposal ?? {
    pick: decision.selected,
    reason: decision.reason,
    source: 'heuristic',
    profile,
  };
  const resolution = resolveWorkflowRouting({
    agentLock: null,
    stepLock: null,
    runRoleLock: null,
    proposal: { kind: 'valid', proposal },
    roleDefault: null,
    sessionDefault: null,
    kindDefault: null,
    availability,
    contextEstimate: null,
  });
  if (resolution.kind === 'blocked') {
    return null;
  }
  const next = resolution.decision;
  return {
    step: {
      ...step,
      providerOverride: next.selected.provider,
      modelOverride: next.selected.model,
      ...(next.selected.effort != null && { effort: next.selected.effort }),
      routingDecision: next,
    },
    decision: next,
  };
};
