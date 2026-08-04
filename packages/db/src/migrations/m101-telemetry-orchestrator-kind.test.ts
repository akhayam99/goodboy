import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';
import { migrations } from './index';

const workspaceId = 'ws-1';
const sessionId = 's-1';

const seedThrough100 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 100),
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
  return db;
};

type RunParams = {
  readonly db: Database;
  readonly runId: string;
};

const insertRun = async ({ db, runId }: RunParams): Promise<void> => {
  await db.execute(
    `INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at)
     VALUES (?, ?, 'anthropic', 'opus-5', 'succeeded', ?)`,
    [runId, sessionId, Date.now()],
  );
};

type RecordParams = {
  readonly db: Database;
  readonly id: string;
  readonly kind: string;
};

const insertRecord = async ({ db, id, kind }: RecordParams): Promise<void> => {
  await insertRun({ db, runId: `run-${id}` });
  await db.execute(
    `INSERT INTO telemetry_records
       (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens,
        estimated_cost_usd, recorded_at, cached_input_tokens, cache_creation_input_tokens, context_tokens)
     VALUES (?, ?, ?, ?, 'anthropic', 'opus-5', 11, 22, 0.5, 1000, 3, 4, 555)`,
    [id, `run-${id}`, sessionId, kind],
  );
};

type DbParams = {
  readonly db: Database;
};

const indexNames = async ({ db }: DbParams): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'telemetry_records' AND sql IS NOT NULL ORDER BY name",
  );
  return rows.map((row) => row.name);
};

describe('m101 telemetry orchestrator kind', () => {
  it('carries every existing row through the rebuild', async () => {
    const db = await seedThrough100();
    await insertRecord({ db, id: 't-1', kind: 'turn' });
    await insertRecord({ db, id: 't-2', kind: 'summarizer' });

    await migrate(db, migrations);

    const rows = await db.select<{
      id: string;
      kind: string;
      input_tokens: number;
      output_tokens: number;
      estimated_cost_usd: number;
      cached_input_tokens: number;
      cache_creation_input_tokens: number;
      context_tokens: number | null;
    }>('SELECT * FROM telemetry_records ORDER BY id');
    expect(rows.map((row) => [row.id, row.kind])).toEqual([
      ['t-1', 'turn'],
      ['t-2', 'summarizer'],
    ]);
    expect(rows[0]).toMatchObject({
      input_tokens: 11,
      output_tokens: 22,
      estimated_cost_usd: 0.5,
      cached_input_tokens: 3,
      cache_creation_input_tokens: 4,
      context_tokens: 555,
    });
  });

  it('accepts the orchestrator kind and still rejects a bogus one', async () => {
    const db = await seedThrough100();
    await migrate(db, migrations);

    await insertRecord({ db, id: 't-orch', kind: 'orchestrator' });
    const rows = await db.select<{ kind: string }>(
      'SELECT kind FROM telemetry_records WHERE id = ?',
      ['t-orch'],
    );
    expect(rows[0]?.kind).toBe('orchestrator');

    await expect(insertRecord({ db, id: 't-bogus', kind: 'planner' })).rejects.toThrow(/CHECK/i);
  });

  it('keeps the indexes and the foreign keys of the rebuilt table', async () => {
    const db = await seedThrough100();
    await insertRecord({ db, id: 't-1', kind: 'turn' });

    await migrate(db, migrations);

    expect(await indexNames({ db })).toEqual([
      'idx_telemetry_recorded_at',
      'idx_telemetry_run_id',
      'idx_telemetry_session_kind',
    ]);
    const violations = await db.select<{ rowid: number }>('PRAGMA foreign_key_check');
    expect(violations).toEqual([]);
    const keys = await db.select<{ table: string; on_delete: string }>(
      'PRAGMA foreign_key_list(telemetry_records)',
    );
    expect(
      [...keys].map((key) => [key.table, key.on_delete]).sort((a, b) => a[0]!.localeCompare(b[0]!)),
    ).toEqual([
      ['provider_runs', 'CASCADE'],
      ['sessions', 'CASCADE'],
    ]);
  });

  it('cascades a session delete through the rebuilt foreign key', async () => {
    const db = await seedThrough100();
    await insertRecord({ db, id: 't-1', kind: 'turn' });

    await migrate(db, migrations);
    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    const rows = await db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM telemetry_records',
    );
    expect(rows[0]?.count).toBe(0);
  });
});
