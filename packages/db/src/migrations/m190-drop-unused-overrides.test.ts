import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

type ColumnRow = {
  readonly name: string;
};

const columnsOf = async ({
  db,
  table,
}: {
  readonly db: Database;
  readonly table: string;
}): Promise<ReadonlyArray<string>> =>
  (await db.select<ColumnRow>(`PRAGMA table_info(${table})`)).map((column) => column.name);

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 189 });
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, default_workflow_id, parallel_enabled, created_at, updated_at)
     VALUES ('workspace', 'Harborline', 'harborline', 'workflow', 1, 1, 1)`,
  );
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, default_workflow_id, parallel_enabled, created_at, updated_at)
     VALUES ('project', 'workspace', 'Api', '/repo/api', 'repo', 'workflow', 0, 1, 1)`,
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, default_workflow_id, parallel_enabled, created_at, updated_at)
     VALUES ('session', 'workspace', 'Goal', 'idle', 'workflow', 1, 1, 1)`,
  );
  return db;
};

describe('m190 drop unused overrides', () => {
  it('drops the dead default_workflow_id and parallel_enabled columns without losing rows', async () => {
    const db = await seed();

    await migrate(db, migrations);

    expect(await columnsOf({ db, table: 'workspaces' })).not.toContain('default_workflow_id');
    expect(await columnsOf({ db, table: 'workspaces' })).not.toContain('parallel_enabled');
    expect(await columnsOf({ db, table: 'projects' })).not.toContain('default_workflow_id');
    expect(await columnsOf({ db, table: 'projects' })).not.toContain('parallel_enabled');
    expect(await columnsOf({ db, table: 'sessions' })).not.toContain('default_workflow_id');
    expect(await columnsOf({ db, table: 'sessions' })).not.toContain('parallel_enabled');

    expect(await db.select('SELECT id, name, slug FROM workspaces')).toEqual([
      { id: 'workspace', name: 'Harborline', slug: 'harborline' },
    ]);
    expect(await db.select('SELECT id, name, root_path FROM projects')).toEqual([
      { id: 'project', name: 'Api', root_path: '/repo/api' },
    ]);
    expect(await db.select('SELECT id, goal, state_kind FROM sessions')).toEqual([
      { id: 'session', goal: 'Goal', state_kind: 'idle' },
    ]);
  });
});
