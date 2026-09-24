import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Skill, SkillId, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { listSkillsForWorkspace, upsertSkill } from './skill';

const workspaceId = 'w1' as WorkspaceId;
const now = new Date('2026-09-08T10:00:00.000Z').toISOString() as IsoDateTime;

type MakeSkillParams = {
  readonly id: string;
};

const makeSkill = ({ id }: MakeSkillParams): Skill => ({
  id: id as SkillId,
  workspaceId,
  name: id,
  description: `the ${id} skill`,
  filePath: `/skills/${id}.md`,
  body: 'steps',
  frontmatter: { name: id, description: `the ${id} skill`, scripts: ['run.sh'] },
  createdAt: now,
  updatedAt: now,
});

describe('skill queries', () => {
  it('skips a skill whose stored frontmatter is malformed and keeps the rest', async () => {
    const db = await makeMigratedTestDatabase();
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [workspaceId, 'Acme', 'acme', 1, 1],
    );
    await upsertSkill(db, makeSkill({ id: 'release' }));
    await upsertSkill(db, makeSkill({ id: 'broken' }));
    await db.execute("UPDATE skills SET frontmatter_json = '{\"name\":1}' WHERE id = 'broken'");

    const skills = await listSkillsForWorkspace(db, workspaceId);

    expect(skills.map((skill) => [skill.id, skill.frontmatter.scripts])).toEqual([
      ['release', ['run.sh']],
    ]);
  });
});
