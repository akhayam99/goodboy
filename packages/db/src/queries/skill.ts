import type { IsoDateTime, Skill, SkillFrontmatter, SkillId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { isJsonRecord, isStringArray, parseJsonColumn } from '../shared/parseJsonColumn';

type SkillRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  file_path: string;
  body: string;
  frontmatter_json: string;
  created_at: number;
  updated_at: number;
};

const isOptionalStringArray = (value: unknown): boolean =>
  value === undefined || isStringArray(value);

const isSkillFrontmatter = (value: unknown): value is SkillFrontmatter =>
  isJsonRecord(value) &&
  typeof value.name === 'string' &&
  typeof value.description === 'string' &&
  isOptionalStringArray(value.args) &&
  isOptionalStringArray(value.scripts);

function toSkill(row: SkillRow): ReadonlyArray<Skill> {
  const frontmatter = parseJsonColumn<SkillFrontmatter | null>({
    value: row.frontmatter_json,
    isValid: isSkillFrontmatter,
    fallback: null,
  });
  if (frontmatter === null) {
    return [];
  }
  return [
    {
      id: row.id as SkillId,
      workspaceId: row.workspace_id as WorkspaceId,
      name: row.name,
      description: row.description,
      filePath: row.file_path,
      body: row.body,
      frontmatter,
      createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
      updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
    },
  ];
}

export const listSkillsForWorkspace = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Skill>> => {
  const rows = await db.select<SkillRow>(
    'SELECT * FROM skills WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId],
  );
  return rows.flatMap(toSkill);
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
      Date.parse(skill.createdAt),
      Date.parse(skill.updatedAt),
    ],
  );
};

export const deleteSkill = async (db: Database, skillId: SkillId): Promise<void> => {
  await db.execute('DELETE FROM skills WHERE id = ?', [skillId]);
};
