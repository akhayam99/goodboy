import type {
  AgentId,
  ChatId,
  ChatMessageId,
  IntegrationCredentialId,
  IsoDateTime,
  SessionEventId,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';

const isAgentId = (value: string): value is AgentId => value.length > 0;
const isCredentialId = (value: string): value is IntegrationCredentialId => value.length > 0;
const isWorkspaceId = (value: string): value is WorkspaceId => value.length > 0;
const isIsoDateTime = (value: string): value is IsoDateTime => value.length > 0;

type Params = {
  readonly value: string;
};

export const agentIdOf = ({ value }: Params): AgentId => {
  if (!isAgentId(value)) {
    throw new Error('empty agent id');
  }
  return value;
};

export const credentialIdOf = ({ value }: Params): IntegrationCredentialId => {
  if (!isCredentialId(value)) {
    throw new Error('empty credential id');
  }
  return value;
};

export const workspaceIdOf = ({ value }: Params): WorkspaceId => {
  if (!isWorkspaceId(value)) {
    throw new Error('empty workspace id');
  }
  return value;
};

const isChatId = (value: string): value is ChatId => value.length > 0;
const isChatMessageId = (value: string): value is ChatMessageId => value.length > 0;

export const chatIdOf = ({ value }: Params): ChatId => {
  if (!isChatId(value)) {
    throw new Error('empty chat id');
  }
  return value;
};

export const chatMessageIdOf = ({ value }: Params): ChatMessageId => {
  if (!isChatMessageId(value)) {
    throw new Error('empty chat message id');
  }
  return value;
};

export const isoDateTimeOf = ({ value }: Params): IsoDateTime => {
  if (!isIsoDateTime(value)) {
    throw new Error('empty date');
  }
  return value;
};

const isSessionEventId = (value: string): value is SessionEventId => value.length > 0;
const isWorkflowId = (value: string): value is WorkflowId => value.length > 0;

export const sessionEventIdOf = ({ value }: Params): SessionEventId => {
  if (!isSessionEventId(value)) {
    throw new Error('empty session event id');
  }
  return value;
};

export const workflowIdOf = ({ value }: Params): WorkflowId => {
  if (!isWorkflowId(value)) {
    throw new Error('empty workflow id');
  }
  return value;
};
