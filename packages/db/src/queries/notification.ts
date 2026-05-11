import type { IsoDateTime, TaskId, WorkspaceId } from '@kay-am/types';
import type { Database } from '../client';

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';
export type NotificationKind =
  | 'session-created'
  | 'session-deleted'
  | 'summarizer-success'
  | 'agent-auto-spawn'
  | 'pr-created'
  | 'workspace-deleted'
  | 'error';

export interface Notification {
  readonly id: string;
  readonly ts: IsoDateTime;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string | null;
  readonly severity: NotificationSeverity;
  readonly sessionId: TaskId | null;
  readonly workspaceId: WorkspaceId | null;
  readonly read: boolean;
}

interface NotificationRow {
  id: string;
  ts: string;
  kind: string;
  title: string;
  body: string | null;
  severity: string;
  session_id: string | null;
  workspace_id: string | null;
  read: number;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    ts: row.ts as IsoDateTime,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    severity: row.severity as NotificationSeverity,
    sessionId: row.session_id ? (row.session_id as TaskId) : null,
    workspaceId: row.workspace_id ? (row.workspace_id as WorkspaceId) : null,
    read: row.read !== 0,
  };
}

export async function insertNotification(db: Database, n: Notification): Promise<void> {
  await db.execute(
    `INSERT INTO notifications (id, ts, kind, title, body, severity, session_id, workspace_id, read)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      n.id,
      n.ts,
      n.kind,
      n.title,
      n.body ?? null,
      n.severity,
      n.sessionId ?? null,
      n.workspaceId ?? null,
      n.read ? 1 : 0,
    ],
  );
}

export async function listNotifications(db: Database): Promise<ReadonlyArray<Notification>> {
  const rows = await db.select<NotificationRow>('SELECT * FROM notifications ORDER BY ts DESC');
  return rows.map(toNotification);
}

export async function markAllNotificationsRead(db: Database): Promise<void> {
  await db.execute('UPDATE notifications SET read = 1 WHERE read = 0');
}

export async function clearAllNotifications(db: Database): Promise<void> {
  await db.execute('DELETE FROM notifications');
}
