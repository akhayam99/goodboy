import type { IsoDateTime, WorkspaceId, WorkspaceScript, WorkspaceScriptId } from '@goodboy/types';
import type { Database } from '../client';

interface WorkspaceScriptRow {
  id: string;
  workspace_id: string;
  name: string;
  body: string;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

function toDomain(row: WorkspaceScriptRow): WorkspaceScript {
  return {
    id: row.id as WorkspaceScriptId,
    workspaceId: row.workspace_id as WorkspaceId,
    name: row.name,
    body: row.body,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  };
}

export async function listWorkspaceScripts(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<WorkspaceScript>> {
  const rows = await db.select<WorkspaceScriptRow>(
    'SELECT * FROM workspace_scripts WHERE workspace_id = ? ORDER BY sort_order ASC, created_at ASC',
    [workspaceId],
  );
  return rows.map(toDomain);
}

export async function upsertWorkspaceScript(db: Database, script: WorkspaceScript): Promise<void> {
  await db.execute(
    `INSERT INTO workspace_scripts
      (id, workspace_id, name, body, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       body = excluded.body,
       sort_order = excluded.sort_order,
       updated_at = excluded.updated_at`,
    [
      script.id,
      script.workspaceId,
      script.name,
      script.body,
      script.sortOrder,
      Date.parse(script.createdAt),
      Date.parse(script.updatedAt),
    ],
  );
}

export async function deleteWorkspaceScript(
  db: Database,
  scriptId: WorkspaceScriptId,
): Promise<void> {
  await db.execute('DELETE FROM workspace_scripts WHERE id = ?', [scriptId]);
}
