import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const seedThrough177 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 177 });
  for (const slug of ['harborline', 'northwind', 'acme']) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
      [`workspace-${slug}`, slug, slug],
    );
  }
  await db.execute(
    `INSERT INTO workspace_profiles (workspace_id, bio, updated_at) VALUES
       ('workspace-harborline', '  Leads the payments platform team.  ', 1),
       ('workspace-northwind', '   ', 1),
       ('workspace-acme', NULL, 1)`,
  );
  return db;
};

describe('m178 workspace profile fields', () => {
  it('copies the old bio into about your work and leaves the new fields empty', async () => {
    const db = await seedThrough177();

    await migrate(db, migrations);

    expect(
      await db.select(
        `SELECT workspace_id, bio, roles_json, about_work, working_rules, explain_more_json
         FROM workspace_profiles ORDER BY workspace_id ASC`,
      ),
    ).toEqual([
      {
        workspace_id: 'workspace-acme',
        bio: null,
        roles_json: null,
        about_work: null,
        working_rules: null,
        explain_more_json: null,
      },
      {
        workspace_id: 'workspace-harborline',
        bio: '  Leads the payments platform team.  ',
        roles_json: null,
        about_work: 'Leads the payments platform team.',
        working_rules: null,
        explain_more_json: null,
      },
      {
        workspace_id: 'workspace-northwind',
        bio: '   ',
        roles_json: null,
        about_work: null,
        working_rules: null,
        explain_more_json: null,
      },
    ]);
  });
});
