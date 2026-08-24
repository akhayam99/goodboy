import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';
const workflowId = 'wf-1';

type InsertRunParams = {
  readonly db: Database;
};

const seedThrough111 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 111),
  );
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset)
     VALUES (?, ?, 'wf', '', ?, ?, 1)`,
    [workflowId, workspaceId, new Date().toISOString(), new Date().toISOString()],
  );
  return db;
};

const insertRun = async ({ db }: InsertRunParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_workflows
       (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run,
        trigger_mode, execution_mode, created_at)
     VALUES ('run-1', ?, ?, 0, 0, 0, 'immediate', 'dynamic', ?)`,
    [sessionId, workflowId, Date.now()],
  );
};

describe('m113 workflow run role models', () => {
  it('leaves existing runs inheriting workspace role models', async () => {
    const db = await seedThrough111();
    await insertRun({ db });

    await migrate(db, migrations);

    const rows = await db.select<{ role_model_overrides: string | null }>(
      'SELECT role_model_overrides FROM session_workflows',
    );
    expect(rows).toEqual([{ role_model_overrides: null }]);
  });

  it('stores role overrides on a new run', async () => {
    const db = await seedThrough111();
    await migrate(db, migrations);
    await insertRun({ db });
    const overrides = JSON.stringify({
      implementer: {
        providerId: 'codex',
        model: 'gpt-5.6-sol',
        effort: 'high',
      },
    });

    await db.execute(
      'UPDATE session_workflows SET role_model_overrides = ? WHERE workflow_run_id = ?',
      [overrides, 'run-1'],
    );

    const rows = await db.select<{ role_model_overrides: string | null }>(
      'SELECT role_model_overrides FROM session_workflows',
    );
    expect(rows).toEqual([{ role_model_overrides: overrides }]);
  });
});
