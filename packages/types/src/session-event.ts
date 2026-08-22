import type { IsoDateTime, SessionEventId, SessionId } from './ids';

export const SESSION_EVENT_KINDS = [
  'worktree_created',
  'branch_created',
  'branch_switched',
  'issue_linked',
  'issue_unlinked',
  'pr_created',
  'pr_ready',
  'pr_approved',
  'pr_merged',
  'pr_closed',
  'workflow_started',
  'workflow_discarded',
  'workflow_restored',
  'workflow_deleted',
  'decisions_changed',
] as const;

export type SessionEventKind = (typeof SESSION_EVENT_KINDS)[number];

export type SessionEventPayload = Readonly<{
  worktreePath?: string;
  branch?: string;
  from?: string;
  to?: string;
  provider?: string;
  identifier?: string;
  title?: string;
  url?: string;
  number?: number;
  workflowName?: string;
  runId?: string;
  added?: number;
  removed?: number;
}>;

export type SessionEvent = Readonly<{
  id: SessionEventId;
  sessionId: SessionId;
  kind: SessionEventKind;
  payload: SessionEventPayload | null;
  createdAt: IsoDateTime;
}>;
