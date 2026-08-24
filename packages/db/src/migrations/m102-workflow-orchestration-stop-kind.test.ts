import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';
const workflowId = 'wf-1';
const BUDGET_MESSAGE = 'the budget cap is reached, raise it in Budget to keep this run going';

const seedThrough101 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 101),
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
  readonly error: string | null;
};

const insertRun = async ({ db, runId, ordinal, error }: RunParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_workflows
       (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run,
        trigger_mode, execution_mode, orchestration_error, orchestrator_hints, created_at)
     VALUES (?, ?, ?, ?, 0, 1, 'immediate', 'dynamic', ?, 'ignore the website', ?)`,
    [runId, sessionId, workflowId, ordinal, error, Date.now()],
  );
};

type StopRow = {
  readonly workflow_run_id: string;
  readonly orchestration_error: string | null;
  readonly orchestration_stop_kind: string;
  readonly orchestrator_hints: string | null;
};

type DbParams = {
  readonly db: Database;
};

const stopRows = async ({ db }: DbParams): Promise<ReadonlyArray<StopRow>> =>
  db.select<StopRow>(
    'SELECT workflow_run_id, orchestration_error, orchestration_stop_kind, orchestrator_hints FROM session_workflows ORDER BY workflow_run_id',
  );

const indexNames = async ({ db }: DbParams): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'session_workflows' AND sql IS NOT NULL ORDER BY name",
  );
  return rows.map((row) => row.name);
};

describe('m102 workflow orchestration stop kind', () => {
  it('reads a run stopped by the budget cap as a budget stop', async () => {
    const db = await seedThrough101();
    await insertRun({ db, runId: 'run-budget', ordinal: 0, error: BUDGET_MESSAGE });

    await migrate(db, migrations);

    const rows = await stopRows({ db });
    expect(rows).toEqual([
      {
        workflow_run_id: 'run-budget',
        orchestration_error: BUDGET_MESSAGE,
        orchestration_stop_kind: 'budget',
        orchestrator_hints: 'ignore the website',
      },
    ]);
  });

  it('keeps every other run on the failure default', async () => {
    const db = await seedThrough101();
    await insertRun({ db, runId: 'run-failed', ordinal: 0, error: 'usage limit reached' });
    await insertRun({ db, runId: 'run-clean', ordinal: 1, error: null });

    await migrate(db, migrations);

    expect(await stopRows({ db })).toEqual([
      {
        workflow_run_id: 'run-clean',
        orchestration_error: null,
        orchestration_stop_kind: 'failure',
        orchestrator_hints: 'ignore the website',
      },
      {
        workflow_run_id: 'run-failed',
        orchestration_error: 'usage limit reached',
        orchestration_stop_kind: 'failure',
        orchestrator_hints: 'ignore the website',
      },
    ]);
  });

  it('defaults a run inserted without the column to a failure stop', async () => {
    const db = await seedThrough101();

    await migrate(db, migrations);
    await insertRun({ db, runId: 'run-new', ordinal: 0, error: 'boom' });

    const rows = await stopRows({ db });
    expect(rows[0]?.orchestration_stop_kind).toBe('failure');
  });

  it('keeps the indexes and the foreign keys of the table', async () => {
    const db = await seedThrough101();
    await insertRun({ db, runId: 'run-budget', ordinal: 0, error: BUDGET_MESSAGE });

    await migrate(db, migrations);

    expect(await indexNames({ db })).toEqual([
      'idx_session_workflows_chain_after_run_id',
      'idx_session_workflows_session_id',
      'idx_session_workflows_workflow_id',
    ]);
    const violations = await db.select<{ rowid: number }>('PRAGMA foreign_key_check');
    expect(violations).toEqual([]);
    const keys = await db.select<{ table: string; on_delete: string }>(
      'PRAGMA foreign_key_list(session_workflows)',
    );
    expect(
      [...keys].map((key) => [key.table, key.on_delete]).sort((a, b) => a[0]!.localeCompare(b[0]!)),
    ).toEqual([
      ['session_workflows', 'SET NULL'],
      ['sessions', 'CASCADE'],
      ['workflows', 'CASCADE'],
    ]);
  });
});
