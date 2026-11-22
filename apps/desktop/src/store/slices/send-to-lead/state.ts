import type { AgentId, AutoTreeId, MountId, SessionId } from '@goodboy/types';

export type SentToLeadPhase = 'sending' | 'sent' | 'failed' | 'stopped';

export type SentToLeadTarget = Readonly<{
  treeId: AutoTreeId | null;
  rootAgentId: AgentId | null;
  sessionId: SessionId;
  title: string;
}>;

export type SentToLead = Readonly<{
  key: string;
  sessionId: SessionId;
  target: SentToLeadTarget;
  isNew: boolean;
  messageId: string;
  text: string;
  note: string;
  threadId: string | null;
  mountId: MountId | null;
  branch: string | null;
  phase: SentToLeadPhase;
  failure: string | null;
}>;

export type SendToLeadState = {
  readonly sentToLead: Readonly<Record<string, SentToLead>>;
};

export const sendToLeadInitialState: SendToLeadState = {
  sentToLead: {},
};
