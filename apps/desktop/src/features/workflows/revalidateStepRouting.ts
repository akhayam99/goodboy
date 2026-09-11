import {
  resolveWorkflowRouting,
  workflowRoutingAvailability,
  type WorkflowRoutingAvailabilitySnapshot,
} from '@goodboy/core';
import type {
  Step,
  WorkflowModelPick,
  WorkflowRoutingDecision,
  WorkflowTaskProfile,
} from '@goodboy/types';

const UNKNOWN_PROFILE: WorkflowTaskProfile = {
  taskType: 'general',
  difficulty: 'unknown',
  basis: 'unknown',
};

type Params = {
  readonly step: Step;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
  readonly runRoleLock?: WorkflowModelPick | null;
};

export type StepRoutingRevalidation =
  | Readonly<{ kind: 'keep' }>
  | Readonly<{ kind: 'replace'; step: Step; decision: WorkflowRoutingDecision }>
  | Readonly<{ kind: 'blocked'; reason: string }>;

const KEEP: StepRoutingRevalidation = { kind: 'keep' };

export const revalidateStepRouting = ({
  step,
  availability,
  runRoleLock = null,
}: Params): StepRoutingRevalidation => {
  const lock = step.routingLock ?? null;
  const decision = step.routingDecision ?? null;
  if (lock === null && decision === null) {
    return KEEP;
  }
  const current = lock?.pick ?? decision?.selected ?? null;
  if (current === null) {
    return KEEP;
  }
  const status = workflowRoutingAvailability({ pick: current, snapshot: availability });
  if (status.kind === 'available') {
    return KEEP;
  }
  const profile = step.taskProfile ?? UNKNOWN_PROFILE;
  const outcome =
    decision === null
      ? ({ kind: 'missing', profile } as const)
      : ({
          kind: 'valid',
          proposal: decision.proposal ?? {
            pick: decision.selected,
            reason: decision.reason,
            source: 'heuristic',
            profile,
          },
        } as const);
  const resolution = resolveWorkflowRouting({
    agentLock: null,
    stepLock: lock,
    runRoleLock,
    proposal: outcome,
    roleDefault: null,
    sessionDefault: null,
    kindDefault: null,
    availability,
    contextEstimate: null,
    missingProposal: 'configured_default',
  });
  if (resolution.kind === 'blocked') {
    return { kind: 'blocked', reason: resolution.reason };
  }
  const next = resolution.decision;
  return {
    kind: 'replace',
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
