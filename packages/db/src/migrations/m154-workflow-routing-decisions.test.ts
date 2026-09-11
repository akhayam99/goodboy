import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const before = migrations.filter((migration) => migration.version < 154);

const seed = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(db, before);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, is_preset) VALUES ('workflow', 'workspace', 'Workflow', '', 1, 1, 1)",
  );
  await db.execute(
    "INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override, effort) VALUES ('step', 'workflow', 0, 'Step', 'Work', 'codex', 'gpt-5.6-sol', 'high')",
  );
  await db.execute(
    'INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run, trigger_mode, execution_mode, role_model_overrides, created_at) VALUES (\'run\', \'session\', \'workflow\', 0, 0, 0, \'immediate\', \'dynamic\', \'{"reviewer":{"providerId":"anthropic","model":"claude-sonnet-4-6","effort":"high"}}\', 1)',
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, step_id, workflow_run_id, ordinal, name, status, provider_override, model_override, effort) VALUES ('agent', 'session', 'step', 'run', 0, 'Agent', 'pending', 'codex', 'gpt-5.6-sol', 'high')",
  );
  return db;
};

const lock = JSON.stringify({
  version: 1,
  pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  origin: 'legacy',
});
const profile = JSON.stringify({ taskType: 'implementation', difficulty: 'heavy', basis: 'agent' });
const decision = JSON.stringify({
  version: 1,
  proposal: null,
  selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  source: 'legacy',
  reason: 'Existing selection',
  adjustment: 'none',
  executed: null,
});

describe('m154 workflow routing decisions', () => {
  it('upgrades populated m153 storage without changing legacy routing', async () => {
    const db = await seed();
    await migrate(db);
    expect(
      await db.select(
        'SELECT provider_override, model_override, effort, routing_lock, routing_decision, task_profile FROM steps',
      ),
    ).toEqual([
      {
        provider_override: 'codex',
        model_override: 'gpt-5.6-sol',
        effort: 'high',
        routing_lock: null,
        routing_decision: null,
        task_profile: null,
      },
    ]);
    expect(await db.select('SELECT role_model_overrides FROM session_workflows')).toEqual([
      {
        role_model_overrides:
          '{"reviewer":{"providerId":"anthropic","model":"claude-sonnet-4-6","effort":"high"}}',
      },
    ]);
  });

  it('round-trips nullable routing fields on steps and agents', async () => {
    const db = await seed();
    await migrate(db);
    for (const table of ['steps', 'agents']) {
      await db.execute(
        `UPDATE ${table} SET routing_lock = ?, routing_decision = ?, task_profile = ?`,
        [lock, decision, profile],
      );
      expect(
        await db.select(`SELECT routing_lock, routing_decision, task_profile FROM ${table}`),
      ).toEqual([{ routing_lock: lock, routing_decision: decision, task_profile: profile }]);
    }
  });

  it('rejects invalid JSON in every new column', async () => {
    const db = await seed();
    await migrate(db);
    for (const table of ['steps', 'agents']) {
      for (const column of ['routing_lock', 'routing_decision', 'task_profile']) {
        await expect(db.execute(`UPDATE ${table} SET ${column} = ?`, ['{'])).rejects.toThrow();
      }
    }
  });

  it('recovers duplicate columns and remains safe to re-enter', async () => {
    const db = await seed();
    await db.exec(
      'ALTER TABLE steps ADD COLUMN routing_lock TEXT DEFAULT NULL CHECK (routing_lock IS NULL OR json_valid(routing_lock))',
    );
    const first = await migrate(db);
    const second = await migrate(db);
    expect(first.applied).toContain(154);
    expect(second.applied).toEqual([]);
    expect(
      await db.select<{ readonly version: number }>(
        'SELECT version FROM schema_version WHERE version = 154',
      ),
    ).toEqual([{ version: 154 }]);
  });
});
