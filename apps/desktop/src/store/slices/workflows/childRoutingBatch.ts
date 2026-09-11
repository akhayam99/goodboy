import type {
  AgentRole,
  ModelEffort,
  ProviderId,
  SessionId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRoutingProposal,
  WorkflowRunId,
  WorkflowTaskProfile,
} from '@goodboy/types';
import type { WorkflowMissingProposalPolicy } from '@goodboy/core';
import { workflowRoutingFlags } from '../../../features/workflows/workflowRoutingFlags';
import { resolveWorkflowChildRouting } from '../workflowRouting/resolveWorkflowChildRouting';
import type { AppStore } from '../../store';

export type ChildRoutingRequest = Readonly<{
  proposal: WorkflowRoutingProposal | null;
  promptText: string;
  childLock: WorkflowRoutingLock | null;
}>;

export type ChildRoutingFields = Readonly<{
  routingLock: WorkflowRoutingLock | null;
  routingDecision: WorkflowRoutingDecision | null;
  taskProfile: WorkflowTaskProfile | null;
  providerOverride: ProviderId | null;
  modelOverride: string | null;
  effort: ModelEffort | null;
}>;

export type ChildRoutingBatch =
  | Readonly<{ kind: 'ready'; entries: ReadonlyArray<ChildRoutingFields> }>
  | Readonly<{ kind: 'blocked'; reason: string }>;

export const LEGACY_CHILD_ROUTING: ChildRoutingFields = {
  routingLock: null,
  routingDecision: null,
  taskProfile: null,
  providerOverride: null,
  modelOverride: null,
  effort: null,
};

type ResolveOneParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly role: AgentRole;
  readonly request: ChildRoutingRequest;
  readonly isChildSelectionEnabled: boolean;
};

export type ChildRoutingOutcome =
  | Readonly<{ kind: 'routed'; fields: ChildRoutingFields }>
  | Readonly<{ kind: 'legacy' }>
  | Readonly<{ kind: 'blocked'; reason: string }>;

type PolicyParams = {
  readonly isChildSelectionEnabled: boolean;
};

const childMissingProposalPolicy = ({
  isChildSelectionEnabled,
}: PolicyParams): WorkflowMissingProposalPolicy => {
  if (isChildSelectionEnabled === false) {
    return 'configured_default';
  }
  return 'deterministic_pick';
};

export const resolveOneChildRouting = ({
  state,
  sessionId,
  workflowRunId,
  role,
  request,
  isChildSelectionEnabled,
}: ResolveOneParams): ChildRoutingOutcome => {
  const { resolution, taskProfile } = resolveWorkflowChildRouting({
    state,
    sessionId,
    workflowRunId,
    role,
    childLock: request.childLock,
    proposal: isChildSelectionEnabled === true ? request.proposal : null,
    promptText: request.promptText,
    missingProposal: childMissingProposalPolicy({ isChildSelectionEnabled }),
  });
  if (resolution.kind === 'blocked') {
    if (isChildSelectionEnabled === false && request.childLock === null) {
      return { kind: 'legacy' };
    }
    return { kind: 'blocked', reason: resolution.reason };
  }
  const decision = resolution.decision;
  return {
    kind: 'routed',
    fields: {
      routingLock: request.childLock,
      routingDecision: decision,
      taskProfile,
      providerOverride: decision.selected.provider,
      modelOverride: decision.selected.model,
      effort: decision.selected.effort,
    },
  };
};

type BatchParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId | null;
  readonly role: AgentRole;
  readonly requests: ReadonlyArray<ChildRoutingRequest>;
};

export const childRoutingBatch = ({
  state,
  sessionId,
  workflowRunId,
  role,
  requests,
}: BatchParams): ChildRoutingBatch => {
  const isChildSelectionEnabled = workflowRoutingFlags().isChildModelSelectionEnabled;
  const entries: Array<ChildRoutingFields> = [];
  for (const request of requests) {
    const outcome = resolveOneChildRouting({
      state,
      sessionId,
      workflowRunId,
      role,
      request,
      isChildSelectionEnabled,
    });
    if (outcome.kind === 'blocked') {
      return { kind: 'blocked', reason: outcome.reason };
    }
    entries.push(outcome.kind === 'legacy' ? LEGACY_CHILD_ROUTING : outcome.fields);
  }
  return { kind: 'ready', entries };
};
