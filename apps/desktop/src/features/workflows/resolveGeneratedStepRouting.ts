import {
  hintedRoutingOutcome,
  parseWorkflowRoutingProposal,
  recommendWorkflowRoutingDecision,
  resolveWorkflowRouting,
  type WorkflowRoutingAvailabilitySnapshot,
  type WorkflowRoutingWireFields,
} from '@goodboy/core';
import type {
  AgentEffort,
  ProviderId,
  WorkflowRoutingDecision,
  WorkflowTaskProfile,
} from '@goodboy/types';

export type GeneratedStepRouting = {
  readonly providerOverride: ProviderId;
  readonly modelOverride: string;
  readonly effort: AgentEffort | null;
  readonly routingDecision: WorkflowRoutingDecision;
  readonly taskProfile: WorkflowTaskProfile | null;
};

type Params = {
  readonly routing: WorkflowRoutingWireFields | undefined;
  readonly promptPrefix: string;
  readonly emittingProvider: ProviderId;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
};

type StoredProfileParams = {
  readonly profile: WorkflowTaskProfile;
};

const storedProfile = ({ profile }: StoredProfileParams): WorkflowTaskProfile | null => {
  if (profile.basis === 'unknown') {
    return null;
  }
  return profile;
};

export const resolveGeneratedStepRouting = ({
  routing,
  promptPrefix,
  emittingProvider,
  availability,
}: Params): GeneratedStepRouting | null => {
  const outcome = hintedRoutingOutcome({
    outcome: parseWorkflowRoutingProposal({ fields: routing ?? {}, emittingProvider }),
    promptText: promptPrefix,
  });
  const profile = outcome.kind === 'valid' ? outcome.proposal.profile : outcome.profile;
  if (outcome.kind !== 'missing') {
    const resolution = resolveWorkflowRouting({
      agentLock: null,
      stepLock: null,
      runRoleLock: null,
      proposal: outcome,
      roleDefault: null,
      sessionDefault: null,
      kindDefault: null,
      availability,
      contextEstimate: null,
      missingProposal: 'deterministic_pick',
    });
    if (resolution.kind === 'ready') {
      return {
        providerOverride: resolution.decision.selected.provider,
        modelOverride: resolution.decision.selected.model,
        effort: resolution.decision.selected.effort,
        routingDecision: resolution.decision,
        taskProfile: storedProfile({ profile }),
      };
    }
    return null;
  }
  const decision = recommendWorkflowRoutingDecision({
    availability,
    profile,
    proposal: null,
    contextEstimate: null,
  });
  if (decision === null) {
    return null;
  }
  return {
    providerOverride: decision.selected.provider,
    modelOverride: decision.selected.model,
    effort: decision.selected.effort,
    routingDecision: decision,
    taskProfile: storedProfile({ profile }),
  };
};
