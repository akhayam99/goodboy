import type { IsoDateTime, Workspace, WorkspaceId, WorkspaceKind } from '@goodboy/types';
import type { Database } from '../client';
import { listMembersForWorkspaces } from './workspace-member';

type WorkspaceRow = {
  id: string;
  name: string;
  root_path: string;
  kind: string | null;
  created_at: number;
  updated_at: number;
  disconnected_at: number | null;
  last_accessed_at: number | null;
};

function toDomain(row: WorkspaceRow): Workspace {
  return {
    id: row.id as WorkspaceId,
    name: row.name,
    rootPath: row.root_path,
    kind: (row.kind === 'composite' ? 'composite' : 'repo') as WorkspaceKind,
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

async function attachMembers(
  db: Database,
  workspaces: ReadonlyArray<Workspace>,
): Promise<ReadonlyArray<Workspace>> {
  const compositeIds = workspaces.filter((w) => w.kind === 'composite').map((w) => w.id);
  if (compositeIds.length === 0) {
    return workspaces;
  }
  const membersByComposite = await listMembersForWorkspaces(db, compositeIds);
  return workspaces.map((w) =>
    w.kind === 'composite' ? { ...w, members: membersByComposite.get(w.id) ?? [] } : w,
  );
}

export const insertWorkspace = async (db: Database, workspace: Workspace): Promise<void> => {
  const created = Date.parse(workspace.createdAt);
  const updated = Date.parse(workspace.updatedAt);
  const accessed = workspace.lastAccessedAt ? Date.parse(workspace.lastAccessedAt) : updated;
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, kind, created_at, updated_at, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      workspace.id,
      workspace.name,
      workspace.rootPath,
      workspace.kind ?? 'repo',
      created,
      updated,
      accessed,
    ],
  );
};

export const getWorkspaceById = async (
  db: Database,
  id: WorkspaceId,
): Promise<Workspace | null> => {
  const rows = await db.select<WorkspaceRow>('SELECT * FROM workspaces WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) {
    return null;
  }
  const [withMembers] = await attachMembers(db, [toDomain(row)]);
  return withMembers ?? null;
};

export const listWorkspaces = async (db: Database): Promise<ReadonlyArray<Workspace>> => {
  const rows = await db.select<WorkspaceRow>(
    'SELECT * FROM workspaces WHERE disconnected_at IS NULL ORDER BY created_at DESC',
  );
  return attachMembers(db, rows.map(toDomain));
};

export const listDisconnectedWorkspaces = async (
  db: Database,
  limit = 10,
): Promise<ReadonlyArray<Workspace>> => {
  const rows = await db.select<WorkspaceRow>(
    'SELECT * FROM workspaces WHERE disconnected_at IS NOT NULL ORDER BY disconnected_at DESC LIMIT ?',
    [limit],
  );
  return attachMembers(db, rows.map(toDomain));
};

export const findWorkspaceByRootPath = async (
  db: Database,
  rootPath: string,
): Promise<Workspace | null> => {
  const rows = await db.select<WorkspaceRow>(
    'SELECT * FROM workspaces WHERE root_path = ? LIMIT 1',
    [rootPath],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  const [withMembers] = await attachMembers(db, [toDomain(row)]);
  return withMembers ?? null;
};

export const disconnectWorkspace = async (
  db: Database,
  id: WorkspaceId,
  at: IsoDateTime,
): Promise<void> => {
  const ts = Date.parse(at);
  await db.execute('UPDATE workspaces SET disconnected_at = ?, updated_at = ? WHERE id = ?', [
    ts,
    ts,
    id,
  ]);
};

export const reconnectWorkspace = async (
  db: Database,
  id: WorkspaceId,
  at: IsoDateTime,
): Promise<void> => {
  const ts = Date.parse(at);
  await db.execute(
    'UPDATE workspaces SET disconnected_at = NULL, updated_at = ?, last_accessed_at = ? WHERE id = ?',
    [ts, ts, id],
  );
};

export const touchWorkspaceLastAccessed = async (db: Database, id: WorkspaceId): Promise<void> => {
  await db.execute('UPDATE workspaces SET last_accessed_at = ? WHERE id = ?', [Date.now(), id]);
};

export const deleteWorkspace = async (db: Database, id: WorkspaceId): Promise<void> => {
  await db.execute('DELETE FROM workspaces WHERE id = ?', [id]);
};
