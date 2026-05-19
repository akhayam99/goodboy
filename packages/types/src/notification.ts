import type { IsoDateTime, SessionId, WorkspaceId } from './ids';

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';

export type NotificationKind =
  | 'session-created'
  | 'session-deleted'
  | 'summarizer-success'
  | 'agent-auto-spawn'
  | 'pr-created'
  | 'workspace-deleted'
  | 'boundary-drift'
  | 'error';

export interface Notification {
  readonly id: string;
  readonly ts: IsoDateTime;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string | null;
  readonly severity: NotificationSeverity;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId | null;
  readonly read: boolean;
}
