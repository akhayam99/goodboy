import type { AgentId, IsoDateTime, SessionId } from './ids';

export const SESSION_DECISION_STATUSES = ['active', 'replaced', 'withdrawn'] as const;

export type SessionDecisionStatus = (typeof SESSION_DECISION_STATUSES)[number];

export const SESSION_DECISION_AUTHORS = ['agent', 'summarizer', 'user'] as const;

export type SessionDecisionAuthor = (typeof SESSION_DECISION_AUTHORS)[number];

export type SessionDecision = Readonly<{
  id: string;
  sessionId: SessionId;
  number: number;
  text: string;
  status: SessionDecisionStatus;
  replacedBy: number | null;
  author: SessionDecisionAuthor;
  agentId: AgentId | null;
  turnOrdinal: number | null;
  reason: string | null;
  closedBy: SessionDecisionAuthor | null;
  closedByAgentId: AgentId | null;
  previousText: string | null;
  rewordedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;
