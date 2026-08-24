import type { IsoDateTime, ProjectId, ProjectScript, ProjectScriptId } from '@goodboy/types';
import type { Database } from '../client';

type ProjectScriptRow = {
  readonly id: string;
  readonly project_id: string;
  readonly name: string;
  readonly body: string;
  readonly sort_order: number;
  readonly created_at: number;
  readonly updated_at: number;
};

type ToDomainParams = {
  readonly row: ProjectScriptRow;
};

const toDomain = ({ row }: ToDomainParams): ProjectScript => ({
  id: row.id as ProjectScriptId,
  projectId: row.project_id as ProjectId,
  name: row.name,
  body: row.body,
  sortOrder: row.sort_order,
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
});

type ListProjectScriptsParams = {
  readonly db: Database;
  readonly projectId: ProjectId;
};

export const listProjectScripts = async ({
  db,
  projectId,
}: ListProjectScriptsParams): Promise<ReadonlyArray<ProjectScript>> => {
  const rows = await db.select<ProjectScriptRow>(
    'SELECT * FROM project_scripts WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC',
    [projectId],
  );
  return rows.map((row) => toDomain({ row }));
};

type UpsertProjectScriptParams = {
  readonly db: Database;
  readonly script: ProjectScript;
};

export const upsertProjectScript = async ({
  db,
  script,
}: UpsertProjectScriptParams): Promise<void> => {
  await db.execute(
    `INSERT INTO project_scripts
      (id, project_id, name, body, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       project_id = excluded.project_id,
       name = excluded.name,
       body = excluded.body,
       sort_order = excluded.sort_order,
       updated_at = excluded.updated_at`,
    [
      script.id,
      script.projectId,
      script.name,
      script.body,
      script.sortOrder,
      Date.parse(script.createdAt),
      Date.parse(script.updatedAt),
    ],
  );
};

type DeleteProjectScriptParams = {
  readonly db: Database;
  readonly scriptId: ProjectScriptId;
};

export const deleteProjectScript = async ({
  db,
  scriptId,
}: DeleteProjectScriptParams): Promise<void> => {
  await db.execute('DELETE FROM project_scripts WHERE id = ?', [scriptId]);
};
