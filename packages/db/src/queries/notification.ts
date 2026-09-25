import type { AgentId, IsoDateTime, ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error';
export type NotificationKind =
  | 'session-created'
  | 'session-deleted'
  | 'summarizer-success'
  | 'summarizer-degraded'
  | 'agent-auto-spawn'
  | 'pr-created'
  | 'workspace-deleted'
  | 'workspace-merged'
  | 'project-adopted'
  | 'boundary-drift'
  | 'branch-changed'
  | 'budget-cap'
  | 'title-generation'
  | 'provider-connected'
  | 'provider-cli-outdated'
  | 'provider-cli-updated'
  | 'orphan-worktrees'
  | 'error';

export type NotificationAction =
  | { readonly kind: 'retry-summarizer'; readonly sessionId: SessionId }
  | {
      readonly kind: 'retry-step-summary';
      readonly sessionId: SessionId;
      readonly agentId: AgentId;
    }
  | {
      readonly kind: 'open-agent';
      readonly sessionId: SessionId;
      readonly agentId: AgentId;
    }
  | { readonly kind: 'open-budget'; readonly sessionId: SessionId | null }
  | { readonly kind: 'open-orphan-worktrees'; readonly workspaceId: WorkspaceId }
  | { readonly kind: 'retry-publication'; readonly sessionId: SessionId }
  | { readonly kind: 'retry-update' }
  | { readonly kind: 'update-provider-cli'; readonly providerId: ProviderId }
  | { readonly kind: 'open-lens'; readonly sessionId: SessionId; readonly lens: 'scripts' };

export type Notification = {
  readonly id: string;
  readonly ts: IsoDateTime;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string | null;
  readonly severity: NotificationSeverity;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId | null;
  readonly read: boolean;
  readonly action: NotificationAction | null;
  readonly coalesceKey: string | null;
};

type NotificationRow = {
  id: string;
  ts: number;
  kind: string;
  title: string;
  body: string | null;
  severity: string;
  session_id: string | null;
  workspace_id: string | null;
  read: number;
  action: string | null;
  coalesce_key: string | null;
};

const NOTIFICATION_ACTION_KINDS = {
  'retry-summarizer': true,
  'retry-step-summary': true,
  'open-agent': true,
  'open-budget': true,
  'open-orphan-worktrees': true,
  'retry-publication': true,
  'retry-update': true,
  'update-provider-cli': true,
  'open-lens': true,
} satisfies Record<NotificationAction['kind'], true>;

const isNotificationAction = (value: unknown): value is NotificationAction =>
  isJsonRecord(value) &&
  typeof value.kind === 'string' &&
  Object.hasOwn(NOTIFICATION_ACTION_KINDS, value.kind);

function parseAction(raw: string | null): NotificationAction | null {
  return parseJsonColumn<NotificationAction | null>({
    value: raw,
    isValid: isNotificationAction,
    fallback: null,
  });
}

function serializeAction(action: NotificationAction | null): string | null {
  return action != null ? JSON.stringify(action) : null;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    ts: new Date(row.ts).toISOString() as IsoDateTime,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    severity: row.severity as NotificationSeverity,
    sessionId: row.session_id ? (row.session_id as SessionId) : null,
    workspaceId: row.workspace_id ? (row.workspace_id as WorkspaceId) : null,
    read: row.read !== 0,
    action: parseAction(row.action),
    coalesceKey: row.coalesce_key,
  };
}

export const insertNotification = async (db: Database, n: Notification): Promise<void> => {
  await db.execute(
    `INSERT INTO notifications (id, ts, kind, title, body, severity, session_id, workspace_id, read, action, coalesce_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      n.id,
      Date.parse(n.ts),
      n.kind,
      n.title,
      n.body ?? null,
      n.severity,
      n.sessionId ?? null,
      n.workspaceId ?? null,
      n.read ? 1 : 0,
      serializeAction(n.action),
      n.coalesceKey,
    ],
  );
};

export const NOTIFICATION_LIST_LIMIT = 200;

const EFFECTIVE_WORKSPACE = `COALESCE(notifications.workspace_id, (SELECT sessions.workspace_id FROM sessions WHERE sessions.id = notifications.session_id))`;

const IN_WORKSPACE = `(${EFFECTIVE_WORKSPACE} IS NULL OR ${EFFECTIVE_WORKSPACE} = ?)`;

export type NotificationCursor = {
  readonly ts: IsoDateTime;
  readonly id: string;
};

type ScopeParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId | null;
};

type ListNotificationsParams = ScopeParams & {
  readonly before?: NotificationCursor | null;
};

type WhereClause = {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
};

type ScopeWhereParams = {
  readonly workspaceId: WorkspaceId | null;
};

const scopeWhere = ({ workspaceId }: ScopeWhereParams): WhereClause =>
  workspaceId == null ? { sql: '1 = 1', params: [] } : { sql: IN_WORKSPACE, params: [workspaceId] };

export const listNotifications = async ({
  db,
  workspaceId,
  before = null,
}: ListNotificationsParams): Promise<ReadonlyArray<Notification>> => {
  const scope = scopeWhere({ workspaceId });
  const beforeTs = before == null ? null : Date.parse(before.ts);
  const cursor: WhereClause =
    before == null
      ? { sql: '1 = 1', params: [] }
      : { sql: '(ts < ? OR (ts = ? AND id < ?))', params: [beforeTs, beforeTs, before.id] };
  const rows = await db.select<NotificationRow>(
    `SELECT * FROM notifications WHERE ${scope.sql} AND ${cursor.sql} ORDER BY ts DESC, id DESC LIMIT ?`,
    [...scope.params, ...cursor.params, NOTIFICATION_LIST_LIMIT],
  );
  return rows.map(toNotification);
};

export type NotificationCountBucket = {
  readonly severity: NotificationSeverity;
  readonly kind: NotificationKind;
  readonly hasSession: boolean;
  readonly hasAction: boolean;
  readonly read: boolean;
  readonly inWorkspace: boolean;
  readonly count: number;
};

type NotificationCountRow = {
  severity: string;
  kind: string;
  has_session: number;
  has_action: number;
  read: number;
  in_workspace: number;
  count: number;
};

export const countNotifications = async ({
  db,
  workspaceId,
}: ScopeParams): Promise<ReadonlyArray<NotificationCountBucket>> => {
  const inWorkspace = workspaceId == null ? '1' : `CASE WHEN ${IN_WORKSPACE} THEN 1 ELSE 0 END`;
  const rows = await db.select<NotificationCountRow>(
    `SELECT severity, kind,
       CASE WHEN session_id IS NULL THEN 0 ELSE 1 END AS has_session,
       CASE WHEN action IS NULL THEN 0 ELSE 1 END AS has_action,
       CASE WHEN read = 0 THEN 0 ELSE 1 END AS read,
       ${inWorkspace} AS in_workspace,
       COUNT(*) AS count
     FROM notifications
     GROUP BY severity, kind, has_session, has_action, read, in_workspace`,
    workspaceId == null ? [] : [workspaceId],
  );
  return rows.map((row) => ({
    severity: row.severity as NotificationSeverity,
    kind: row.kind as NotificationKind,
    hasSession: row.has_session !== 0,
    hasAction: row.has_action !== 0,
    read: row.read !== 0,
    inWorkspace: row.in_workspace !== 0,
    count: row.count,
  }));
};

export const markAllNotificationsRead = async ({ db, workspaceId }: ScopeParams): Promise<void> => {
  const scope = scopeWhere({ workspaceId });
  await db.execute(`UPDATE notifications SET read = 1 WHERE read = 0 AND ${scope.sql}`, [
    ...scope.params,
  ]);
};

type SingleNotificationParams = {
  readonly db: Database;
  readonly id: string;
};

export const markNotificationRead = async ({ db, id }: SingleNotificationParams): Promise<void> => {
  await db.execute('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
};

export const deleteNotification = async ({ db, id }: SingleNotificationParams): Promise<void> => {
  await db.execute('DELETE FROM notifications WHERE id = ?', [id]);
};

export const clearAllNotifications = async ({ db, workspaceId }: ScopeParams): Promise<void> => {
  const scope = scopeWhere({ workspaceId });
  await db.execute(`DELETE FROM notifications WHERE ${scope.sql}`, scope.params);
};
