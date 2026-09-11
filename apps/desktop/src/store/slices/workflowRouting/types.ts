import type { AgentId, SessionId, StepId, WorkflowModelPick } from '@goodboy/types';

export type { GetFn, SetFn } from '../../slice-types';

export type WorkflowRoutingNodeKind = 'step' | 'agent';

export type WorkflowRoutingNodeRef = {
  readonly nodeKind: WorkflowRoutingNodeKind;
  readonly id: StepId | AgentId;
};

export type SetWorkflowNodeRoutingLockParams = WorkflowRoutingNodeRef & {
  readonly sessionId: SessionId;
  readonly pick: WorkflowModelPick;
};

export type ResetWorkflowNodeRoutingLockParams = WorkflowRoutingNodeRef & {
  readonly sessionId: SessionId;
};

export type WorkflowRoutingState = {
  readonly workflowNodeRoutingPending: Readonly<Record<string, boolean>>;
  readonly workflowNodeRoutingErrors: Readonly<Record<string, string | null>>;
};
