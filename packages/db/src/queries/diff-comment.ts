import type {
  AgentId,
  DiffComment,
  DiffCommentAnchor,
  DiffCommentSide,
  DiffCommentStatus,
  IsoDateTime,
  SessionId,
} from '@kay-am/types';
import type { Database } from '../client';

interface DiffCommentRow {
  id: string;
  session_id: string;
  file_path: string;
  body: string;
  status: string;
  created_at: number;
  resolved_at: number | null;
  consumed_at: number | null;
  consumed_by_agent_id: string | null;
  line_number: number | null;
  line_side: string | null;
}

function toDomain(row: DiffCommentRow): DiffComment {
  const anchor: DiffCommentAnchor | undefined =
    row.line_number !== null && row.line_side !== null
      ? { lineNumber: row.line_number, side: row.line_side as DiffCommentSide }
      : undefined;
  return {
    id: row.id,
    sessionId: row.session_id as SessionId,
    filePath: row.file_path,
    body: row.body,
    status: row.status as DiffCommentStatus,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    resolvedAt:
      row.resolved_at !== null
        ? (new Date(row.resolved_at).toISOString() as IsoDateTime)
        : undefined,
    consumedAt:
      row.consumed_at !== null
        ? (new Date(row.consumed_at).toISOString() as IsoDateTime)
        : undefined,
    consumedByAgentId:
      row.consumed_by_agent_id !== null ? (row.consumed_by_agent_id as AgentId) : undefined,
    anchor,
  };
}

const SELECT_COLUMNS = `id, session_id, file_path, body, status, created_at, resolved_at,
    consumed_at, consumed_by_agent_id, line_number, line_side`;

export async function insertDiffComment(
  db: Database,
  id: string,
  sessionId: SessionId,
  filePath: string,
  body: string,
  anchor?: DiffCommentAnchor,
): Promise<void> {
  await db.execute(
    `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at, line_number, line_side)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
    [id, sessionId, filePath, body, Date.now(), anchor?.lineNumber ?? null, anchor?.side ?? null],
  );
}

export async function listDiffCommentsForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<DiffComment>> {
  const rows = await db.select<DiffCommentRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM diff_comments
     WHERE session_id = ?
     ORDER BY created_at ASC`,
    [sessionId],
  );
  return rows.map(toDomain);
}

export async function resolveDiffComment(db: Database, id: string): Promise<void> {
  await db.execute(`UPDATE diff_comments SET status = 'resolved', resolved_at = ? WHERE id = ?`, [
    Date.now(),
    id,
  ]);
}

export async function consumeDiffComments(
  db: Database,
  ids: ReadonlyArray<string>,
  agentId: AgentId,
): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(', ');
  await db.execute(
    `UPDATE diff_comments
     SET status = 'consumed', consumed_at = ?, consumed_by_agent_id = ?
     WHERE status = 'open' AND id IN (${placeholders})`,
    [Date.now(), agentId, ...ids],
  );
}

export async function reopenDiffComment(db: Database, id: string): Promise<void> {
  await db.execute(
    `UPDATE diff_comments
     SET status = 'open', consumed_at = NULL, consumed_by_agent_id = NULL
     WHERE id = ?`,
    [id],
  );
}

export async function deleteDiffComment(db: Database, id: string): Promise<void> {
  await db.execute(`DELETE FROM diff_comments WHERE id = ?`, [id]);
}
