import {
  hintedRoutingOutcome,
  parseWorkflowRoutingProposal,
  resolveWorkflowRouting,
  type WorkflowRoutingAvailabilitySnapshot,
  type WorkflowRoutingWireFields,
} from '@goodboy/core/orchestrator';
import type {
  AgentEffort,
  ProviderId,
  WorkflowRoutingDecision,
  WorkflowTaskProfile,
} from '@goodboy/types';

export type GeneratedStepPick = {
  readonly providerOverride: ProviderId;
  readonly modelOverride: string;
  readonly effort: AgentEffort | null;
  readonly routingDecision: WorkflowRoutingDecision;
};

export type GeneratedStepRouting = {
  readonly pick: GeneratedStepPick | null;
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
}: Params): GeneratedStepRouting => {
  const outcome = hintedRoutingOutcome({
    outcome: parseWorkflowRoutingProposal({ fields: routing ?? {}, emittingProvider }),
    promptText: promptPrefix,
  });
  const profile = outcome.kind === 'valid' ? outcome.proposal.profile : outcome.profile;
  const taskProfile = storedProfile({ profile });
  if (outcome.kind === 'missing') {
    return { pick: null, taskProfile };
  }
  const resolution = resolveWorkflowRouting({
    agentLock: null,
    stepLock: null,
    proposal: outcome,
    roleDefault: null,
    sessionDefault: null,
    kindDefault: null,
    availability,
    contextEstimate: null,
    missingProposal: 'deterministic_pick',
  });
  if (resolution.kind !== 'ready') {
    return { pick: null, taskProfile };
  }
  return {
    pick: {
      providerOverride: resolution.decision.selected.provider,
      modelOverride: resolution.decision.selected.model,
      effort: resolution.decision.selected.effort,
      routingDecision: resolution.decision,
    },
    taskProfile,
  };
};
