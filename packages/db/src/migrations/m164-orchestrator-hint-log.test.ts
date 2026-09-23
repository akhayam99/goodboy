import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { toOrchestratorHintLog } from '../queries/orchestrator-hint-log';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 164);

type HintLogRow = {
  readonly workflow_run_id: string;
  readonly orchestrator_hint_log: string | null;
};

const insertRun = async (db: Database, id: string, hints: string | null): Promise<void> => {
  await db.execute(
    `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, orchestrator_hints, created_at)
     VALUES (?, 'session', 'workflow', 0, 0, ?, 1767225600000)`,
    [id, hints],
  );
};

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, before);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Northwind', 'northwind', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'ship notify-relay', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow', 'workspace', 'Delivery', 1, 1)",
  );
  await insertRun(db, 'run-hinted', '  keep it to one PR  ');
  await insertRun(db, 'run-blank', '   ');
  await insertRun(db, 'run-none', null);
  return db;
};

const hintLogs = async (db: Database): Promise<ReadonlyArray<HintLogRow>> =>
  db.select<HintLogRow>(
    'SELECT workflow_run_id, orchestrator_hint_log FROM session_workflows ORDER BY workflow_run_id',
  );

describe('m164 orchestrator hint log', () => {
  it('has no hint log column before the migration', async () => {
    const db = await seed();
    await expect(hintLogs(db)).rejects.toThrow();
  });

  it('carries a standing hint over as one entry', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const row = (await hintLogs(db)).find((entry) => entry.workflow_run_id === 'run-hinted');
    const log = toOrchestratorHintLog({ value: row?.orchestrator_hint_log ?? null });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      text: 'keep it to one PR',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(log[0]?.consumedAt).toBeUndefined();
  });

  it('leaves runs without a standing hint empty', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const rows = await hintLogs(db);
    expect(rows.find((entry) => entry.workflow_run_id === 'run-blank')?.orchestrator_hint_log).toBe(
      null,
    );
    expect(rows.find((entry) => entry.workflow_run_id === 'run-none')?.orchestrator_hint_log).toBe(
      null,
    );
  });
});
