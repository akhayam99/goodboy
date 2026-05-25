import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

interface WorkspaceRow {
  id: string;
  name: string;
  root_path: string;
  created_at: number;
  updated_at: number;
  disconnected_at: number | null;
  last_accessed_at: number | null;
}

function toDomain(row: WorkspaceRow): Workspace {
  return {
    id: row.id as WorkspaceId,
    name: row.name,
    rootPath: row.root_path,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
    ...(row.disconnected_at != null
      ? { disconnectedAt: new Date(row.disconnected_at).toISOString() as IsoDateTime }
      : {}),
    ...(row.last_accessed_at != null
      ? { lastAccessedAt: new Date(row.last_accessed_at).toISOString() as IsoDateTime }
      : {}),
  };
}

export async function insertWorkspace(db: Database, workspace: Workspace): Promise<void> {
  const created = Date.parse(workspace.createdAt);
  const updated = Date.parse(workspace.updatedAt);
  const accessed = workspace.lastAccessedAt ? Date.parse(workspace.lastAccessedAt) : updated;
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?)',
    [workspace.id, workspace.name, workspace.rootPath, created, updated, accessed],
  );
}

export async function getWorkspaceById(db: Database, id: WorkspaceId): Promise<Workspace | null> {
  const rows = await db.select<WorkspaceRow>('SELECT * FROM workspaces WHERE id = ?', [id]);
  const row = rows[0];
  return row ? toDomain(row) : null;
}

/**
 * Returns only active workspaces (disconnected_at IS NULL). Disconnected ones
 * stay in the DB so their sessions/worktrees can be reattached on re-add.
 */
export async function listWorkspaces(db: Database): Promise<ReadonlyArray<Workspace>> {
  const rows = await db.select<WorkspaceRow>(
    'SELECT * FROM workspaces WHERE disconnected_at IS NULL ORDER BY created_at DESC',
  );
  return rows.map(toDomain);
}

/**
 * Lookup by root_path across all workspaces (active + disconnected). Used
 * during add to surface "already exists" and to reactivate a disconnected one.
 */
export async function findWorkspaceByRootPath(
  db: Database,
  rootPath: string,
): Promise<Workspace | null> {
  const rows = await db.select<WorkspaceRow>(
    'SELECT * FROM workspaces WHERE root_path = ? LIMIT 1',
    [rootPath],
  );
  const row = rows[0];
  return row ? toDomain(row) : null;
}

/** Soft delete. Sessions, worktrees, transcripts stay intact. */
export async function disconnectWorkspace(
  db: Database,
  id: WorkspaceId,
  at: IsoDateTime,
): Promise<void> {
  const ts = Date.parse(at);
  await db.execute('UPDATE workspaces SET disconnected_at = ?, updated_at = ? WHERE id = ?', [
    ts,
    ts,
    id,
  ]);
}

/** Clears disconnected_at and refreshes last_accessed_at so the workspace shows up again. */
export async function reconnectWorkspace(
  db: Database,
  id: WorkspaceId,
  at: IsoDateTime,
): Promise<void> {
  const ts = Date.parse(at);
  await db.execute(
    'UPDATE workspaces SET disconnected_at = NULL, updated_at = ?, last_accessed_at = ? WHERE id = ?',
    [ts, ts, id],
  );
}

/** Updates last_accessed_at to now. Called on workspace switch. */
export async function touchWorkspaceLastAccessed(db: Database, id: WorkspaceId): Promise<void> {
  await db.execute('UPDATE workspaces SET last_accessed_at = ? WHERE id = ?', [Date.now(), id]);
}

/** Hard delete. Used only by data-purge flows / tests. UI prefers disconnect. */
export async function deleteWorkspace(db: Database, id: WorkspaceId): Promise<void> {
  await db.execute('DELETE FROM workspaces WHERE id = ?', [id]);
}
