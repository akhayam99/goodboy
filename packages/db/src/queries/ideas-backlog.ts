import type {
  IdeaBacklog,
  IdeaBacklogId,
  IdeaBacklogStatus,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';

interface IdeaRow {
  id: string;
  raw_text: string;
  rephrased_title: string | null;
  rephrased_body: string | null;
  suggested_workspace_id: string | null;
  workspace_id: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

function toDomain(row: IdeaRow): IdeaBacklog {
  return {
    id: row.id as IdeaBacklogId,
    rawText: row.raw_text,
    rephrasedTitle: row.rephrased_title,
    rephrasedBody: row.rephrased_body,
    suggestedWorkspaceId:
      row.suggested_workspace_id !== null ? (row.suggested_workspace_id as WorkspaceId) : null,
    workspaceId: row.workspace_id as WorkspaceId,
    status: row.status as IdeaBacklogStatus,
    retryCount: row.retry_count,
    lastError: row.last_error,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

export interface InsertIdeaInput {
  readonly id: IdeaBacklogId;
  readonly rawText: string;
  readonly workspaceId: WorkspaceId;
}

export async function insertIdea(db: Database, input: InsertIdeaInput): Promise<IdeaBacklog> {
  const now = Date.now();
  await db.execute(
    `INSERT INTO ideas_backlog
       (id, raw_text, rephrased_title, rephrased_body, suggested_workspace_id,
        workspace_id, status, retry_count, last_error, created_at, updated_at)
     VALUES (?, ?, NULL, NULL, NULL, ?, 'raw', 0, NULL, ?, ?)`,
    [input.id, input.rawText, input.workspaceId, now, now],
  );
  const rows = await db.select<IdeaRow>(
    `SELECT id, raw_text, rephrased_title, rephrased_body, suggested_workspace_id,
            workspace_id, status, retry_count, last_error, created_at, updated_at
     FROM ideas_backlog WHERE id = ?`,
    [input.id],
  );
  if (rows.length === 0) throw new Error(`insertIdea: row not found after insert id=${input.id}`);
  return toDomain(rows[0]!);
}

export async function updateIdeaRephrase(
  db: Database,
  id: IdeaBacklogId,
  title: string,
  body: string,
  suggestedWorkspaceId: WorkspaceId | null,
): Promise<IdeaBacklog> {
  const now = Date.now();
  await db.execute(
    `UPDATE ideas_backlog
        SET rephrased_title = ?, rephrased_body = ?, suggested_workspace_id = ?,
            status = 'rephrased', last_error = NULL, updated_at = ?
      WHERE id = ?`,
    [title, body, suggestedWorkspaceId, now, id],
  );
  const rows = await db.select<IdeaRow>(
    `SELECT id, raw_text, rephrased_title, rephrased_body, suggested_workspace_id,
            workspace_id, status, retry_count, last_error, created_at, updated_at
     FROM ideas_backlog WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) throw new Error(`updateIdeaRephrase: row not found id=${id}`);
  return toDomain(rows[0]!);
}

export async function updateIdeaFailed(
  db: Database,
  id: IdeaBacklogId,
  retryCount: number,
  lastError: string,
): Promise<IdeaBacklog> {
  const now = Date.now();
  // After two failed retries we surface 'failed'; before that we leave it raw
  // so the recovery sweep retries it next boot.
  const nextStatus: IdeaBacklogStatus = retryCount >= 2 ? 'failed' : 'raw';
  await db.execute(
    `UPDATE ideas_backlog
        SET retry_count = ?, last_error = ?, status = ?, updated_at = ?
      WHERE id = ?`,
    [retryCount, lastError, nextStatus, now, id],
  );
  const rows = await db.select<IdeaRow>(
    `SELECT id, raw_text, rephrased_title, rephrased_body, suggested_workspace_id,
            workspace_id, status, retry_count, last_error, created_at, updated_at
     FROM ideas_backlog WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) throw new Error(`updateIdeaFailed: row not found id=${id}`);
  return toDomain(rows[0]!);
}

export async function markIdeaSpawned(db: Database, id: IdeaBacklogId): Promise<void> {
  const now = Date.now();
  await db.execute(`UPDATE ideas_backlog SET status = 'spawned', updated_at = ? WHERE id = ?`, [
    now,
    id,
  ]);
}

export async function deleteIdea(db: Database, id: IdeaBacklogId): Promise<void> {
  await db.execute(`DELETE FROM ideas_backlog WHERE id = ?`, [id]);
}

export async function listIdeasForWorkspace(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<IdeaBacklog>> {
  const rows = await db.select<IdeaRow>(
    `SELECT id, raw_text, rephrased_title, rephrased_body, suggested_workspace_id,
            workspace_id, status, retry_count, last_error, created_at, updated_at
     FROM ideas_backlog
     WHERE workspace_id = ? AND status != 'spawned'
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows.map(toDomain);
}

export async function listRawIdeas(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<IdeaBacklog>> {
  const rows = await db.select<IdeaRow>(
    `SELECT id, raw_text, rephrased_title, rephrased_body, suggested_workspace_id,
            workspace_id, status, retry_count, last_error, created_at, updated_at
     FROM ideas_backlog
     WHERE workspace_id = ? AND status = 'raw'
     ORDER BY created_at ASC`,
    [workspaceId],
  );
  return rows.map(toDomain);
}
