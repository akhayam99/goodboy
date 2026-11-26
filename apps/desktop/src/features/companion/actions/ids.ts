import {
  brandId,
  type AgentId,
  type AutoTreeId,
  type SessionId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';

type ValueParams = {
  readonly value: string;
};

export const sessionIdOf = ({ value }: ValueParams): SessionId => brandId<SessionId>({ value });

export const agentIdOf = ({ value }: ValueParams): AgentId => brandId<AgentId>({ value });

export const workspaceIdOf = ({ value }: ValueParams): WorkspaceId =>
  brandId<WorkspaceId>({ value });

export const treeIdOf = ({ value }: ValueParams): AutoTreeId => brandId<AutoTreeId>({ value });

export const workflowRunIdOf = ({ value }: ValueParams): WorkflowRunId =>
  brandId<WorkflowRunId>({ value });
