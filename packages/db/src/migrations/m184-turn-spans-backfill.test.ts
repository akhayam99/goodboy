import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

type SeedRunParams = {
  readonly db: Database;
  readonly runId: string;
  readonly agentId: string | null;
  readonly status?: 'succeeded' | 'failed';
  readonly createdAt?: number;
  readonly finishedAt?: number | string | null;
  readonly model?: string;
};

const seedBase = async ({ db }: { readonly db: Database }): Promise<void> => {
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Settle the ledger', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status, kind) VALUES ('implementer', 'session', 1, 'Implementer', 'completed', 'implementer'), ('debugger', 'session', 2, 'Debugger', 'idle', 'debugger'), ('chat', 'session', 3, 'Agent', 'idle', NULL)",
  );
};

const seedRun = async ({
  db,
  runId,
  agentId,
  status = 'succeeded',
  createdAt = 1_000,
  finishedAt = 61_000,
  model = 'claude-sonnet-5',
}: SeedRunParams): Promise<void> => {
  const payload = finishedAt === null ? {} : { finishedAt };
  await db.execute(
    'INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [runId, 'session', 'anthropic', model, status, JSON.stringify(payload), createdAt],
  );
  if (agentId === null) {
    return;
  }
  await db.execute(
    'INSERT INTO turn_events (id, session_id, agent_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    [
      `${runId}-done`,
      'session',
      agentId,
      JSON.stringify({ kind: 'done', runId, at: '2026-09-01T00:00:00.000Z' }),
      createdAt,
    ],
  );
};

type SpanRow = {
  readonly run_id: string;
  readonly agent_id: string | null;
  readonly workspace_id: string;
  readonly step_role: string;
  readonly model: string;
  readonly effort: string | null;
  readonly started_at: number;
  readonly ended_at: number;
  readonly end_reason: string;
  readonly cost_usd: number | null;
};

const spans = async ({ db }: { readonly db: Database }): Promise<ReadonlyArray<SpanRow>> =>
  db.select<SpanRow>(
    'SELECT run_id, agent_id, workspace_id, step_role, model, effort, started_at, ended_at, end_reason, cost_usd FROM agent_turn_spans ORDER BY run_id',
  );

const helperTables = async ({ db }: { readonly db: Database }) =>
  db.select("SELECT name FROM sqlite_master WHERE name = 'm184_run_agents'");

describe('m184 turn spans backfill', () => {
  it('writes one span per succeeded run it can tie to an agent', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });
    await seedBase({ db });
    await seedRun({ db, runId: 'run-a', agentId: 'implementer' });
    await seedRun({
      db,
      runId: 'run-b',
      agentId: 'debugger',
      createdAt: Date.parse('2026-09-01T10:00:00.000Z'),
      finishedAt: '2026-09-01T10:04:00.000Z',
    });
    await seedRun({ db, runId: 'run-c', agentId: 'chat', finishedAt: 31_000 });
    await seedRun({ db, runId: 'run-failed', agentId: 'implementer', status: 'failed' });
    await seedRun({ db, runId: 'run-orphan', agentId: null });
    await seedRun({ db, runId: 'run-backwards', agentId: 'chat', finishedAt: 500 });
    await seedRun({ db, runId: 'run-unfinished', agentId: 'chat', finishedAt: null });
    await db.execute(
      "INSERT INTO telemetry_records (id, run_id, session_id, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at) VALUES ('t1', 'run-a', 'session', 'anthropic', 'claude-sonnet-5', 1, 1, 0.25, 1), ('t2', 'run-a', 'session', 'anthropic', 'claude-sonnet-5', 1, 1, 0.5, 1)",
    );

    await migrate(db, migrations);

    expect(await spans({ db })).toEqual([
      {
        run_id: 'run-a',
        agent_id: 'implementer',
        workspace_id: 'workspace',
        step_role: 'implementer',
        model: 'claude-sonnet-5',
        effort: null,
        started_at: 1_000,
        ended_at: 61_000,
        end_reason: 'succeeded',
        cost_usd: 0.75,
      },
      {
        run_id: 'run-b',
        agent_id: 'debugger',
        workspace_id: 'workspace',
        step_role: 'investigator',
        model: 'claude-sonnet-5',
        effort: null,
        started_at: Date.parse('2026-09-01T10:00:00.000Z'),
        ended_at: Date.parse('2026-09-01T10:04:00.000Z'),
        end_reason: 'succeeded',
        cost_usd: null,
      },
      {
        run_id: 'run-c',
        agent_id: 'chat',
        workspace_id: 'workspace',
        step_role: 'custom',
        model: 'claude-sonnet-5',
        effort: null,
        started_at: 1_000,
        ended_at: 31_000,
        end_reason: 'succeeded',
        cost_usd: null,
      },
    ]);
    expect(await helperTables({ db })).toEqual([]);
  });

  it('ties the last run of an agent whose events were pruned', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });
    await seedBase({ db });
    await seedRun({ db, runId: 'run-pruned', agentId: null });
    await db.execute("UPDATE agents SET provider_run_id = 'run-pruned' WHERE id = 'implementer'");

    await migrate(db, migrations);

    expect((await spans({ db })).map((span) => [span.run_id, span.agent_id])).toEqual([
      ['run-pruned', 'implementer'],
    ]);
  });

  it('keeps a span the app already recorded', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });
    await seedBase({ db });
    await seedRun({ db, runId: 'run-live', agentId: 'implementer' });
    await db.execute(
      "INSERT INTO agent_turn_spans (run_id, agent_id, session_id, workspace_id, step_role, provider, model, effort, started_at, ended_at, end_reason) VALUES ('run-live', 'implementer', 'session', 'workspace', 'implementer', 'anthropic', 'claude-sonnet-5', 'high', 2000, 9000, 'succeeded')",
    );

    await migrate(db, migrations);

    expect((await spans({ db })).map((span) => [span.run_id, span.effort, span.ended_at])).toEqual([
      ['run-live', 'high', 9000],
    ]);
  });

  it('resumes after a crash halfway and ends with every span once', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });
    await seedBase({ db });
    const runIds = ['0', '5', '9', 'a', 'f', 'x'].map((suffix) => `run-${suffix}`);
    for (const runId of runIds) {
      await seedRun({ db, runId, agentId: 'implementer' });
    }
    await db.exec(`CREATE TRIGGER m184_crash BEFORE INSERT ON agent_turn_spans
      WHEN NEW.run_id = 'run-a' BEGIN SELECT RAISE(ABORT, 'power cut'); END`);

    await expect(migrate(db, migrations)).rejects.toThrow('power cut');
    expect((await spans({ db })).map((span) => span.run_id)).toEqual(['run-0', 'run-5', 'run-9']);
    expect(await db.select('SELECT version FROM schema_version WHERE version = 184')).toEqual([]);

    await db.exec('DROP TRIGGER m184_crash');
    await migrate(db, migrations);

    expect((await spans({ db })).map((span) => span.run_id)).toEqual(runIds);
    expect(await db.select('SELECT version FROM schema_version WHERE version = 184')).toEqual([
      { version: 184 },
    ]);
    expect(await db.select('SELECT * FROM schema_migration_segment')).toEqual([]);
    expect(await helperTables({ db })).toEqual([]);
  });

  it('backfills thousands of runs among many unrelated events quickly', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 173 });
    await seedBase({ db });
    const runCount = 7_000;
    for (let index = 0; index < runCount; index += 1) {
      const runId = crypto.randomUUID();
      const createdAt = 1_000 + index * 10_000;
      await db.execute(
        'INSERT INTO provider_runs (id, session_id, provider, model, status_kind, status_payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          runId,
          'session',
          'anthropic',
          'claude-sonnet-5',
          'succeeded',
          JSON.stringify({ finishedAt: createdAt + 5_000 }),
          createdAt,
        ],
      );
      const agentId = index % 2 === 0 ? 'implementer' : 'chat';
      await db.execute(
        'INSERT INTO turn_events (id, session_id, agent_id, payload, created_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
        [
          `${runId}-text`,
          'session',
          agentId,
          JSON.stringify({ kind: 'assistant_text', runId, delta: 'x'.repeat(2_000), at: 'now' }),
          createdAt,
          `${runId}-tool`,
          'session',
          agentId,
          JSON.stringify({ kind: 'tool_call_end', runId, output: 'done', isError: false }),
          createdAt,
          `${runId}-done`,
          'session',
          agentId,
          JSON.stringify({ kind: 'done', runId, at: 'now' }),
          createdAt,
        ],
      );
    }

    const startedAt = performance.now();
    await migrate(db, migrations);
    const elapsedMs = performance.now() - startedAt;

    expect(
      await db.select(
        'SELECT COUNT(*) AS count, SUM(ended_at - started_at) AS total FROM agent_turn_spans',
      ),
    ).toEqual([{ count: runCount, total: runCount * 5_000 }]);
    expect(elapsedMs).toBeLessThan(5_000);
  });
});
