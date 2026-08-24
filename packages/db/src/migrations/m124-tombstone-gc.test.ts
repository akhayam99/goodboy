import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = 1_775_000_000_000;

const seedThrough123 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 123),
  );
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Workspace', 'workspace', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'Goal', 'idle', ?, ?)`,
    [NOW, NOW],
  );
  for (const [id, deletedAt] of [
    ['workflow-live', null],
    ['workflow-referenced', NOW - 2],
    ['workflow-orphan', NOW - 1],
  ] as const) {
    await db.execute(
      `INSERT INTO workflows (
         id, workspace_id, name, description, created_at, updated_at, deleted_at
       ) VALUES (?, 'workspace-1', ?, '', '2026-01-01', '2026-01-01', ?)`,
      [id, id, deletedAt],
    );
  }
  await db.execute(
    `INSERT INTO session_workflows (
       workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run
     ) VALUES ('run-1', 'session-1', 'workflow-referenced', 0, 0, 0)`,
  );
  await db.execute(
    `INSERT INTO step_library (
       id, workspace_id, role, name, prompt_prefix, created_at, updated_at, deleted_at
     ) VALUES ('library-referenced', 'workspace-1', 'custom', 'Referenced', '', '2026-01-01', '2026-01-01', ?)`,
    [NOW - 2],
  );
  await db.execute(
    `INSERT INTO step_library (
       id, workspace_id, role, name, prompt_prefix, created_at, updated_at, deleted_at
     ) VALUES ('library-orphan', 'workspace-1', 'custom', 'Orphan', '', '2026-01-01', '2026-01-01', ?)`,
    [NOW - 1],
  );
  await db.execute(
    `INSERT INTO steps (
       id, workflow_id, library_step_id, ordinal, name, prompt_prefix, deleted_at
     ) VALUES ('step-referenced', 'workflow-live', 'library-referenced', 0, 'Referenced', '', ?)`,
    [NOW - 2],
  );
  await db.execute(
    `INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix, deleted_at)
     VALUES ('step-orphan', 'workflow-live', 1, 'Orphan', '', ?)`,
    [NOW - 1],
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, step_id, ordinal, name, status)
     VALUES ('agent-1', 'session-1', 'step-referenced', 0, 'Agent', 'completed')`,
  );
  return db;
};

describe('m124 tombstone gc', () => {
  it('keeps referenced tombstones and removes only proven orphans', async () => {
    const db = await seedThrough123();
    await migrate(db, migrations);

    const workflows = await db.select<{ readonly id: string }>(
      'SELECT id FROM workflows ORDER BY id',
    );
    const steps = await db.select<{ readonly id: string }>('SELECT id FROM steps ORDER BY id');
    const library = await db.select<{ readonly id: string }>(
      "SELECT id FROM step_library WHERE id LIKE 'library-%' ORDER BY id",
    );

    expect(workflows).toEqual([{ id: 'workflow-live' }, { id: 'workflow-referenced' }]);
    expect(steps).toEqual([{ id: 'step-referenced' }]);
    expect(library).toEqual([{ id: 'library-referenced' }]);
    expect(await db.select<{ readonly rowid: number }>('PRAGMA foreign_key_check')).toEqual([]);
  });
});
