import type { IsoDateTime, Workspace, WorkspaceId } from '@kay-am/types';
import type { Database } from '../client';

interface WorkspaceRow {
  id: string;
  name: string;
  root_path: string;
  created_at: number;
  updated_at: number;
}

function toDomain(row: WorkspaceRow): Workspace {
  return {
    id: row.id as WorkspaceId,
    name: row.name,
    rootPath: row.root_path,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

export async function insertWorkspace(db: Database, workspace: Workspace): Promise<void> {
  const created = Date.parse(workspace.createdAt);
  const updated = Date.parse(workspace.updatedAt);
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspace.id, workspace.name, workspace.rootPath, created, updated],
  );
}

export async function getWorkspaceById(db: Database, id: WorkspaceId): Promise<Workspace | null> {
  const rows = await db.select<WorkspaceRow>('SELECT * FROM workspaces WHERE id = ?', [id]);
  const row = rows[0];
  return row ? toDomain(row) : null;
}

export async function listWorkspaces(db: Database): Promise<ReadonlyArray<Workspace>> {
  const rows = await db.select<WorkspaceRow>('SELECT * FROM workspaces ORDER BY created_at DESC');
  return rows.map(toDomain);
}
