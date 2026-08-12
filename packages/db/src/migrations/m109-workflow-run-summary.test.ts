import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';
const workflowId = 'wf-1';

const seedThrough108 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 108),
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
        trigger_mode, execution_mode, orchestration_reason)
     VALUES (?, ?, ?, ?, 0, 1, 'immediate', 'dynamic', 'the plan is settled')`,
    [runId, sessionId, workflowId, ordinal],
  );
};

type SummaryRow = {
  readonly workflow_run_id: string;
  readonly orchestration_reason: string | null;
  readonly orchestrator_summary: string | null;
};

type DbParams = {
  readonly db: Database;
};

const summaryRows = async ({ db }: DbParams): Promise<ReadonlyArray<SummaryRow>> =>
  db.select<SummaryRow>(
    'SELECT workflow_run_id, orchestration_reason, orchestrator_summary FROM session_workflows ORDER BY workflow_run_id',
  );

describe('m109 workflow run summary', () => {
  it('leaves an existing run without a recap and keeps its reason', async () => {
    const db = await seedThrough108();
    await insertRun({ db, runId: 'run-old', ordinal: 0 });

    await migrate(db, migrations);

    expect(await summaryRows({ db })).toEqual([
      {
        workflow_run_id: 'run-old',
        orchestration_reason: 'the plan is settled',
        orchestrator_summary: null,
      },
    ]);
  });

  it('stores a recap written after the migration', async () => {
    const db = await seedThrough108();

    await migrate(db, migrations);
    await insertRun({ db, runId: 'run-new', ordinal: 0 });
    await db.execute(
      'UPDATE session_workflows SET orchestrator_summary = ? WHERE workflow_run_id = ?',
      ['- shipped the gate\n- tests still missing', 'run-new'],
    );

    expect((await summaryRows({ db }))[0]?.orchestrator_summary).toBe(
      '- shipped the gate\n- tests still missing',
    );
  });

  it('keeps the indexes and the foreign keys of the table', async () => {
    const db = await seedThrough108();
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
