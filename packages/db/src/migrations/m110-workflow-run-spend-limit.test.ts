import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';
const workflowId = 'wf-1';

const seedThrough109 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 109),
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

type RunParams = {
  readonly db: Database;
  readonly runId: string;
  readonly ordinal: number;
};

const insertRun = async ({ db, runId, ordinal }: RunParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_workflows
       (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run,
        trigger_mode, execution_mode)
     VALUES (?, ?, ?, ?, 0, 1, 'immediate', 'dynamic')`,
    [runId, sessionId, workflowId, ordinal],
  );
};

type SpendRow = {
  readonly workflow_run_id: string;
  readonly spend_limit_usd: number | null;
  readonly spend_limit_mode: string;
};

type DbParams = {
  readonly db: Database;
};

const spendRows = async ({ db }: DbParams): Promise<ReadonlyArray<SpendRow>> =>
  db.select<SpendRow>(
    'SELECT workflow_run_id, spend_limit_usd, spend_limit_mode FROM session_workflows ORDER BY workflow_run_id',
  );

describe('m110 workflow run spend limit', () => {
  it('leaves an existing run uncapped and in pause mode', async () => {
    const db = await seedThrough109();
    await insertRun({ db, runId: 'run-old', ordinal: 0 });

    await migrate(db, migrations);

    expect(await spendRows({ db })).toEqual([
      { workflow_run_id: 'run-old', spend_limit_usd: null, spend_limit_mode: 'pause' },
    ]);
  });

  it('stores a notifying limit written after the migration', async () => {
    const db = await seedThrough109();

    await migrate(db, migrations);
    await insertRun({ db, runId: 'run-new', ordinal: 0 });
    await db.execute(
      'UPDATE session_workflows SET spend_limit_usd = ?, spend_limit_mode = ? WHERE workflow_run_id = ?',
      [12.5, 'notify', 'run-new'],
    );

    expect(await spendRows({ db })).toEqual([
      { workflow_run_id: 'run-new', spend_limit_usd: 12.5, spend_limit_mode: 'notify' },
    ]);
  });

  it('keeps the indexes and the foreign keys of the table', async () => {
    const db = await seedThrough109();
    await insertRun({ db, runId: 'run-old', ordinal: 0 });

    await migrate(db, migrations);

    const indexes = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_workflows' AND sql IS NOT NULL ORDER BY name",
    );
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_session_workflows_session_id',
      'idx_session_workflows_workflow_id',
    ]);
    expect(await db.select<{ rowid: number }>('PRAGMA foreign_key_check')).toEqual([]);
  });
});
