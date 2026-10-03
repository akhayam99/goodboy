import type {
  AgentId,
  AgentRole,
  IsoDateTime,
  SessionContextItem,
  SessionContextItemDraft,
  SessionContextItemId,
  SessionContextItemKind,
  SessionContextItemSource,
  SessionContextItemStatus,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { isJsonRecord, isStringArray, parseJsonColumn } from '../shared/parseJsonColumn';

type Row = {
  readonly id: string;
  readonly session_id: string | null;
  readonly workspace_id: string;
  readonly kind: string;
  readonly title: string;
  readonly text: string;
  readonly topic: string | null;
  readonly source_json: string | null;
  readonly audience_json: string;
  readonly status: string;
  readonly project_name: string | null;
  readonly is_session_deleted: number;
  readonly created_at: number;
  readonly updated_at: number;
};

type StoredSource = {
  readonly role: string;
  readonly agentId: string | null;
  readonly turnStart: number;
  readonly turnEnd: number;
};

const isSource = (value: unknown): value is StoredSource =>
  isJsonRecord(value) &&
  typeof value.role === 'string' &&
  (value.agentId === null || typeof value.agentId === 'string') &&
  typeof value.turnStart === 'number' &&
  typeof value.turnEnd === 'number';

const isStoredSource = (value: unknown): value is StoredSource | null =>
  value === null || isSource(value);

const sourceOf = ({
  value,
}: {
  readonly value: string | null;
}): SessionContextItemSource | null => {
  const stored = parseJsonColumn<StoredSource | null>({
    value,
    isValid: isStoredSource,
    fallback: null,
  });
  if (stored === null) {
    return null;
  }
  return {
    role: stored.role as AgentRole,
    agentId: stored.agentId === null ? null : (stored.agentId as AgentId),
    turnStart: stored.turnStart,
    turnEnd: stored.turnEnd,
  };
};

const kindOf = ({ value }: { readonly value: string }): SessionContextItemKind =>
  value === 'note' ? 'note' : 'learning';

const statusOf = ({ value }: { readonly value: string }): SessionContextItemStatus =>
  value === 'dismissed' ? 'dismissed' : 'active';

const isoOf = (value: number): IsoDateTime => new Date(value).toISOString() as IsoDateTime;

const toDomain = (row: Row): SessionContextItem => ({
  id: row.id as SessionContextItemId,
  sessionId: row.session_id === null ? null : (row.session_id as SessionId),
  workspaceId: row.workspace_id as WorkspaceId,
  kind: kindOf({ value: row.kind }),
  title: row.title,
  text: row.text,
  topic: row.topic,
  source: sourceOf({ value: row.source_json }),
  audience: parseJsonColumn({
    value: row.audience_json,
    isValid: isStringArray,
    fallback: [],
  }) as ReadonlyArray<AgentRole>,
  status: statusOf({ value: row.status }),
  projectName: row.project_name,
  isSessionDeleted: row.is_session_deleted === 1,
  createdAt: isoOf(row.created_at),
  updatedAt: isoOf(row.updated_at),
});

const SELECT = `SELECT
    i.id,
    i.session_id,
    i.workspace_id,
    i.kind,
    i.title,
    i.text,
    i.topic,
    i.source_json,
    i.audience_json,
    i.status,
    p.name AS project_name,
    CASE WHEN s.id IS NULL OR s.deleted_at IS NOT NULL THEN 1 ELSE 0 END AS is_session_deleted,
    i.created_at,
    i.updated_at
  FROM session_context_items i
  LEFT JOIN sessions s ON s.id = i.session_id
  LEFT JOIN projects p ON p.id = s.active_project_id`;

type InsertParams = {
  readonly db: Database;
  readonly items: ReadonlyArray<SessionContextItemDraft>;
};

export const insertSessionContextItems = async ({ db, items }: InsertParams): Promise<void> => {
  if (items.length === 0) {
    return;
  }
  await db.transaction({
    statements: items.map((item) => {
      const createdAt = Date.parse(item.createdAt);
      return {
        sql: `INSERT INTO session_context_items
          (id, session_id, workspace_id, kind, title, text, topic, source_json, audience_json, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          item.id,
          item.sessionId,
          item.workspaceId,
          item.kind,
          item.title,
          item.text,
          item.topic,
          item.source === null ? null : JSON.stringify(item.source),
          JSON.stringify(item.audience),
          item.status,
          createdAt,
          createdAt,
        ],
      };
    }),
  });
};

type SessionParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

export const listSessionContextItems = async ({
  db,
  sessionId,
}: SessionParams): Promise<ReadonlyArray<SessionContextItem>> => {
  const rows = await db.select<Row>(
    `${SELECT}
      WHERE i.session_id = ?
      ORDER BY i.created_at DESC, i.id ASC`,
    [sessionId],
  );
  return rows.map(toDomain);
};

type RoleParams = SessionParams & {
  readonly role: AgentRole;
};

export const listSessionContextItemsForRole = async ({
  db,
  sessionId,
  role,
}: RoleParams): Promise<ReadonlyArray<SessionContextItem>> => {
  const rows = await db.select<Row>(
    `${SELECT}
      WHERE i.session_id = ?
        AND i.status = 'active'
        AND EXISTS (SELECT 1 FROM json_each(i.audience_json) WHERE json_each.value = ?)
      ORDER BY i.created_at ASC, i.id ASC`,
    [sessionId, role],
  );
  return rows.map(toDomain);
};

type WorkspaceParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listWorkspaceLearnings = async ({
  db,
  workspaceId,
}: WorkspaceParams): Promise<ReadonlyArray<SessionContextItem>> => {
  const rows = await db.select<Row>(
    `${SELECT}
      WHERE i.workspace_id = ? AND i.kind = 'learning'
      ORDER BY i.created_at DESC, i.id ASC`,
    [workspaceId],
  );
  return rows.map(toDomain);
};

type StatusParams = {
  readonly db: Database;
  readonly id: SessionContextItemId;
  readonly status: SessionContextItemStatus;
  readonly updatedAt: IsoDateTime;
};

export const setSessionContextItemStatus = async ({
  db,
  id,
  status,
  updatedAt,
}: StatusParams): Promise<boolean> => {
  const result = await db.execute(
    'UPDATE session_context_items SET status = ?, updated_at = ? WHERE id = ?',
    [status, Date.parse(updatedAt), id],
  );
  return result.rowsAffected > 0;
};
