import type {
  AgentRole,
  EffortLevel,
  ProviderId,
  SessionId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRoutingProposal,
  WorkflowRunId,
  WorkflowTaskProfile,
} from '@goodboy/types';
import { resolveWorkflowChildRouting } from '../workflowRouting/resolveWorkflowChildRouting';
import type { AppStore } from '../../store';

type ChildRoutingRequest = Readonly<{
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
  effort: EffortLevel | null;
}>;

export type ChildRoutingBatch =
  | Readonly<{ kind: 'ready'; entries: ReadonlyArray<ChildRoutingFields> }>
  | Readonly<{ kind: 'blocked'; reason: string }>;

type ResolveOneParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly role: AgentRole;
  readonly request: ChildRoutingRequest;
  readonly workflowRunId?: WorkflowRunId | null;
};

type ChildRoutingOutcome =
  | Readonly<{ kind: 'routed'; fields: ChildRoutingFields }>
  | Readonly<{ kind: 'blocked'; reason: string }>;

export const resolveOneChildRouting = ({
  state,
  sessionId,
  role,
  request,
  workflowRunId = null,
}: ResolveOneParams): ChildRoutingOutcome => {
  const { resolution, taskProfile } = resolveWorkflowChildRouting({
    state,
    sessionId,
    role,
    childLock: request.childLock,
    proposal: request.proposal,
    promptText: request.promptText,
    missingProposal: 'deterministic_pick',
    workflowRunId,
  });
  if (resolution.kind === 'blocked') {
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
  readonly role: AgentRole;
  readonly requests: ReadonlyArray<ChildRoutingRequest>;
  readonly workflowRunId?: WorkflowRunId | null;
};

export const childRoutingBatch = ({
  state,
  sessionId,
  role,
  requests,
  workflowRunId = null,
}: BatchParams): ChildRoutingBatch => {
  const entries: Array<ChildRoutingFields> = [];
  for (const request of requests) {
    const outcome = resolveOneChildRouting({
      state,
      sessionId,
      role,
      request,
      workflowRunId,
    });
    if (outcome.kind === 'blocked') {
      return { kind: 'blocked', reason: outcome.reason };
    }
    entries.push(outcome.fields);
  }
  return { kind: 'ready', entries };
};
