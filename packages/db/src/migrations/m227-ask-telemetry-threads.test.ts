import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrateThrough } from '../test-helpers/migration-rows';

const SESSION = 'session-1';

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 226 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('${SESSION}', 'workspace', 'Fix webhook retries', 'idle', 1, 1)`,
  );
  await db.execute(
    `INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at)
     VALUES ('run-1', '${SESSION}', 'anthropic', 'claude-sonnet-5-5', 'succeeded', 1)`,
  );
  await db.execute(
    `INSERT INTO telemetry_records
       (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens,
        estimated_cost_usd, recorded_at, cached_input_tokens, cache_creation_input_tokens, context_tokens)
     VALUES ('t-1', 'run-1', '${SESSION}', 'orchestrator', 'anthropic', 'claude-sonnet-5-5', 11, 22, 0.5, 1000, 3, 4, 555)`,
  );
  await db.execute(
    `INSERT INTO chats (id, workspace_id, title, provider, model, last_activity_at, created_at, updated_at)
     VALUES ('chat-1', 'workspace', 'Where is consent?', 'anthropic', 'claude-sonnet-5-5', 1, 1, 1)`,
  );
  const result = await migrateThrough({ db, version: 227 });
  expect(result.applied).toEqual([227]);
  return db;
};

const indexNames = async (db: Database): Promise<ReadonlyArray<string>> => {
  const rows = await db.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'telemetry_records' AND sql IS NOT NULL ORDER BY name",
  );
  return rows.map((row) => row.name);
};

describe('m227 ask telemetry and threads', () => {
  it('carries every telemetry row and every index through the rebuild', async () => {
    const db = await seedBefore();
    const rows = await db.select<Record<string, unknown>>(
      'SELECT id, kind, estimated_cost_usd, context_tokens FROM telemetry_records',
    );
    expect(rows).toEqual([
      { id: 't-1', kind: 'orchestrator', estimated_cost_usd: 0.5, context_tokens: 555 },
    ]);
    expect(await indexNames(db)).toEqual([
      'idx_telemetry_provider',
      'idx_telemetry_recorded_at',
      'idx_telemetry_run_id',
      'idx_telemetry_session_kind',
    ]);
  });

  it('accepts the ask kind and still refuses an unknown kind', async () => {
    const db = await seedBefore();
    await db.execute(
      `INSERT INTO telemetry_records
         (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at)
       VALUES ('t-ask', 'run-1', '${SESSION}', 'ask', 'anthropic', 'claude-sonnet-5-5', 1, 1, 0.04, 2)`,
    );
    await expect(
      db.execute(
        `INSERT INTO telemetry_records
           (id, run_id, session_id, kind, provider, model, input_tokens, output_tokens, estimated_cost_usd, recorded_at)
         VALUES ('t-bad', 'run-1', '${SESSION}', 'gossip', 'anthropic', 'claude-sonnet-5-5', 1, 1, 0.04, 2)`,
      ),
    ).rejects.toThrow();
  });

  it('keeps workspace chats without a session and drops a session thread with its session', async () => {
    const db = await seedBefore();
    await db.execute(
      `INSERT INTO chats (id, workspace_id, title, provider, model, last_activity_at, created_at, updated_at, session_id)
       VALUES ('ask-1', 'workspace', 'What needs me?', 'anthropic', 'claude-sonnet-5-5', 2, 2, 2, '${SESSION}')`,
    );
    const before = await db.select<{ id: string; session_id: string | null }>(
      'SELECT id, session_id FROM chats ORDER BY id',
    );
    expect(before).toEqual([
      { id: 'ask-1', session_id: SESSION },
      { id: 'chat-1', session_id: null },
    ]);
    await db.execute(`DELETE FROM sessions WHERE id = '${SESSION}'`);
    const after = await db.select<{ id: string }>('SELECT id FROM chats ORDER BY id');
    expect(after).toEqual([{ id: 'chat-1' }]);
  });
});
