import type { IsoDateTime, WorkspaceId, WorkspaceInitScript } from '@kay-am/types';
import type { Database } from '../client';

const HISTORY_CAP = 20;

// Re-export so legacy `import { WorkspaceInitScript } from '@kay-am/db'`
// keeps working; new code should import from @kay-am/types directly.
export type { WorkspaceInitScript } from '@kay-am/types';

interface InitScriptRow {
  id: string;
  workspace_id: string;
  content: string;
  created_at: number;
}

function toDomain(row: InitScriptRow): WorkspaceInitScript {
  return {
    id: row.id,
    workspaceId: row.workspace_id as WorkspaceId,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

export async function insertInitScript(
  db: Database,
  params: { id: string; workspaceId: WorkspaceId; content: string },
): Promise<void> {
  await db.execute(
    `INSERT INTO workspace_init_scripts (id, workspace_id, content, created_at)
     VALUES (?, ?, ?, ?)`,
    [params.id, params.workspaceId, params.content, Date.now()],
  );
  await db.execute(
    `DELETE FROM workspace_init_scripts
     WHERE workspace_id = ? AND id NOT IN (
       SELECT id FROM workspace_init_scripts
       WHERE workspace_id = ?
       ORDER BY created_at DESC
       LIMIT ${HISTORY_CAP}
     )`,
    [params.workspaceId, params.workspaceId],
  );
}

export async function getLatestInitScript(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<WorkspaceInitScript | null> {
  const rows = await db.select<InitScriptRow>(
    `SELECT id, workspace_id, content, created_at
     FROM workspace_init_scripts
     WHERE workspace_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [workspaceId],
  );
  const first = rows[0];
  return first ? toDomain(first) : null;
}

export async function deleteInitScript(db: Database, id: string): Promise<void> {
  await db.execute(`DELETE FROM workspace_init_scripts WHERE id = ?`, [id]);
}

export async function listInitScriptHistory(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<WorkspaceInitScript>> {
  const rows = await db.select<InitScriptRow>(
    `SELECT id, workspace_id, content, created_at
     FROM workspace_init_scripts
     WHERE workspace_id = ?
     ORDER BY created_at DESC`,
    [workspaceId],
  );
  return rows.map(toDomain);
}
