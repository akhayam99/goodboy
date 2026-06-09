import type { IsoDateTime, Skill, SkillFrontmatter, SkillId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

type SkillRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  file_path: string;
  body: string;
  frontmatter_json: string;
  created_at: string;
  updated_at: string;
};

function toSkill(row: SkillRow): Skill {
  return {
    id: row.id as SkillId,
    workspaceId: row.workspace_id as WorkspaceId,
    name: row.name,
    description: row.description,
    filePath: row.file_path,
    body: row.body,
    frontmatter: JSON.parse(row.frontmatter_json) as SkillFrontmatter,
    createdAt: row.created_at as IsoDateTime,
    updatedAt: row.updated_at as IsoDateTime,
  };
}

export const listSkillsForWorkspace = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Skill>> => {
  const rows = await db.select<SkillRow>(
    'SELECT * FROM skills WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId],
  );
  return rows.map(toSkill);
};

export const getSkillById = async (db: Database, skillId: SkillId): Promise<Skill | null> => {
  const rows = await db.select<SkillRow>('SELECT * FROM skills WHERE id = ?', [skillId]);
  return rows[0] ? toSkill(rows[0]) : null;
};

export const upsertSkill = async (db: Database, skill: Skill): Promise<void> => {
  await db.execute(
    `INSERT INTO skills
      (id, workspace_id, name, description, file_path, body, frontmatter_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       file_path = excluded.file_path,
       body = excluded.body,
       frontmatter_json = excluded.frontmatter_json,
       updated_at = excluded.updated_at`,
    [
      skill.id,
      skill.workspaceId,
      skill.name,
      skill.description,
      skill.filePath,
      skill.body,
      JSON.stringify(skill.frontmatter),
      skill.createdAt,
      skill.updatedAt,
    ],
  );
};

export const deleteSkill = async (db: Database, skillId: SkillId): Promise<void> => {
  await db.execute('DELETE FROM skills WHERE id = ?', [skillId]);
};

export const deleteSkillsForWorkspace = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<void> => {
  await db.execute('DELETE FROM skills WHERE workspace_id = ?', [workspaceId]);
};
