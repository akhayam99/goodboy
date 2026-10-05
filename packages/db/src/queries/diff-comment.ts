import type {
  AgentId,
  DiffComment,
  DiffCommentAnchor,
  DiffCommentAuthorKind,
  DiffCommentSide,
  DiffCommentStatus,
  IsoDateTime,
  ProjectId,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

type DiffCommentRow = {
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
  end_line_number: number | null;
  author_kind: string;
  author_agent_id: string | null;
  project_id: string | null;
  branch: string | null;
};

export type DiffCommentAuthor = {
  readonly kind: DiffCommentAuthorKind;
  readonly agentId?: AgentId;
};

function toDomain(row: DiffCommentRow): DiffComment {
  const anchor: DiffCommentAnchor | undefined =
    row.line_number !== null && row.line_side !== null
      ? {
          lineNumber: row.line_number,
          side: row.line_side as DiffCommentSide,
          ...(row.end_line_number != null ? { endLineNumber: row.end_line_number } : {}),
        }
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
    authorKind: row.author_kind === 'agent' ? 'agent' : 'user',
    ...(row.author_agent_id !== null && { authorAgentId: row.author_agent_id as AgentId }),
    ...(row.project_id !== null && { projectId: row.project_id as ProjectId }),
    ...(row.branch !== null && { branch: row.branch }),
  };
}

const SELECT_COLUMNS = `id, session_id, file_path, body, status, created_at, resolved_at,
    consumed_at, consumed_by_agent_id, line_number, line_side, end_line_number, author_kind,
    author_agent_id, project_id, branch`;

export type DiffCommentTarget = {
  readonly projectId: ProjectId;
  readonly branch: string;
};

export const insertDiffComment = async (
  db: Database,
  id: string,
  sessionId: SessionId,
  filePath: string,
  body: string,
  anchor?: DiffCommentAnchor,
  author: DiffCommentAuthor = { kind: 'user' },
  target?: DiffCommentTarget,
): Promise<void> => {
  await db.execute(
    `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at, line_number, line_side, end_line_number, author_kind, author_agent_id, project_id, branch)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sessionId,
      filePath,
      body,
      Date.now(),
      anchor?.lineNumber ?? null,
      anchor?.side ?? null,
      anchor?.endLineNumber ?? null,
      author.kind,
      author.agentId ?? null,
      target?.projectId ?? null,
      target?.branch ?? null,
    ],
  );
};

const millisOf = (value: IsoDateTime | undefined): number | null =>
  value === undefined ? null : Date.parse(value);

export const restoreDiffComment = async (db: Database, comment: DiffComment): Promise<void> => {
  await db.execute(
    `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at, resolved_at, consumed_at, consumed_by_agent_id, line_number, line_side, end_line_number, author_kind, author_agent_id, project_id, branch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      comment.id,
      comment.sessionId,
      comment.filePath,
      comment.body,
      comment.status,
      Date.parse(comment.createdAt),
      millisOf(comment.resolvedAt),
      millisOf(comment.consumedAt),
      comment.consumedByAgentId ?? null,
      comment.anchor?.lineNumber ?? null,
      comment.anchor?.side ?? null,
      comment.anchor?.endLineNumber ?? null,
      comment.authorKind,
      comment.authorAgentId ?? null,
      comment.projectId ?? null,
      comment.branch ?? null,
    ],
  );
};

export const assignDiffCommentTarget = async (
  db: Database,
  id: string,
  target: DiffCommentTarget,
): Promise<void> => {
  await db.execute(`UPDATE diff_comments SET project_id = ?, branch = ? WHERE id = ?`, [
    target.projectId,
    target.branch,
    id,
  ]);
};

export const listDiffCommentsForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<DiffComment>> => {
  const rows = await db.select<DiffCommentRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM diff_comments
     WHERE session_id = ?
     ORDER BY created_at ASC`,
    [sessionId],
  );
  return rows.map(toDomain);
};

export const resolveDiffComment = async (db: Database, id: string): Promise<void> => {
  await db.execute(`UPDATE diff_comments SET status = 'resolved', resolved_at = ? WHERE id = ?`, [
    Date.now(),
    id,
  ]);
};

export const reopenDiffComment = async (db: Database, id: string): Promise<void> => {
  await db.execute(
    `UPDATE diff_comments
     SET status = 'open', consumed_at = NULL, consumed_by_agent_id = NULL
     WHERE id = ?`,
    [id],
  );
};

export const deleteDiffComment = async (db: Database, id: string): Promise<void> => {
  await db.execute(`DELETE FROM diff_comments WHERE id = ?`, [id]);
};
