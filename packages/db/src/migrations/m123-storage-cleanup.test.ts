import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = 1_775_000_000_000;

const seedThrough122 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 122),
  );
  await db.execute(
    `INSERT INTO workspaces (
       id, name, slug, default_branch_prefix, scout_fanout, created_at, updated_at
     ) VALUES ('workspace-1', 'Workspace', 'workspace', 'column-prefix', 1, ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO projects (
       id, workspace_id, name, root_path, created_at, updated_at, deleted_at,
       disconnected_at, scout_fanout, kind
     ) VALUES ('project-1', 'workspace-1', 'Project', '/tmp/project', ?, ?, ?, NULL, 0, 'repo')`,
    [NOW, NOW, NOW - 1],
  );
  await db.execute(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('workspace.workspace-1.branch_prefix', 'kv-prefix', ?)`,
    [NOW],
  );
  await db.execute(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('workspace.workspace-1.agent_title_mode', 'role', ?)`,
    [NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'Goal', 'idle', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status)
     VALUES ('agent-1', 'session-1', 0, 'Agent', 'pending')`,
  );
  await db.execute(
    `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at)
     VALUES ('comment-open', 'session-1', 'a.ts', 'open', 'open', ?)`,
    [NOW],
  );
  await db.execute(
    `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at)
     VALUES ('comment-deleted', 'session-1', 'b.ts', 'deleted', 'deleted', ?)`,
    [NOW],
  );
  return db;
};

const columnsFor = async ({ db, table }: { readonly db: Database; readonly table: string }) => {
  const rows = await db.select<{ readonly name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
};

describe('m123 storage cleanup', () => {
  it('moves branch prefix to the workspace row and renames parallel agents', async () => {
    const db = await seedThrough122();
    await migrate(db, migrations);

    const workspaces = await db.select<{
      readonly default_branch_prefix: string;
      readonly parallel_agents: number;
    }>('SELECT default_branch_prefix, parallel_agents FROM workspaces');
    const settings = await db.select<{ readonly key: string }>(
      "SELECT key FROM settings WHERE key LIKE 'workspace.%.branch_prefix' OR key LIKE 'workspace.%.agent_title_mode'",
    );

    expect(workspaces).toEqual([{ default_branch_prefix: 'kv-prefix', parallel_agents: 1 }]);
    expect(settings).toEqual([]);
    expect(await columnsFor({ db, table: 'projects' })).toContain('parallel_agents');
    expect(await columnsFor({ db, table: 'projects' })).not.toContain('deleted_at');
  });

  it('drops unused soft-delete and library inheritance columns', async () => {
    const db = await seedThrough122();
    await migrate(db, migrations);

    expect(await columnsFor({ db, table: 'skills' })).not.toContain('deleted_at');
    expect(await columnsFor({ db, table: 'permission_rules' })).not.toContain('deleted_at');
    expect(await columnsFor({ db, table: 'step_library' })).not.toContain('base_step_id');
    expect(await db.select<{ readonly rowid: number }>('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('removes retired diff-comment tombstones and rejects the status', async () => {
    const db = await seedThrough122();
    await migrate(db, migrations);

    const rows = await db.select<{ readonly id: string }>(
      'SELECT id FROM diff_comments ORDER BY id',
    );

    expect(rows).toEqual([{ id: 'comment-open' }]);
    await expect(
      db.execute(
        `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at)
         VALUES ('comment-new', 'session-1', 'c.ts', 'deleted', 'deleted', ?)`,
        [NOW],
      ),
    ).rejects.toThrow(/CHECK constraint/);
  });
});
