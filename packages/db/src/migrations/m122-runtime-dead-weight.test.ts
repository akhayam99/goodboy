import { describe, expect, it } from 'vitest';
import type { WorkflowRunId } from '@goodboy/types';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { updateWorkflowOrder } from '../queries/session-workflow';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = 1_775_000_000_123;
const ACTIVITY_AT = '2026-04-01T10:20:30.456Z';

const seedThrough121 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 121),
  );
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Workspace', 'workspace', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at)
     VALUES ('workflow-1', 'workspace-1', 'Workflow', '', ?, ?)`,
    [ACTIVITY_AT, ACTIVITY_AT],
  );
  await db.execute(
    `INSERT INTO steps (id, workflow_id, ordinal, name, prompt_prefix, parallel_group)
     VALUES ('step-1', 'workflow-1', 0, 'Step', '', 7)`,
  );
  await db.execute(
    `INSERT INTO sessions (
       id, workspace_id, goal, state_kind, state_payload, provider_enabled,
       skip_init, user_status, workflow_id, current_step_ordinal, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'session-1',
      'workspace-1',
      'Goal',
      'idle',
      JSON.stringify({ lastActivityAt: ACTIVITY_AT }),
      'anthropic, codex,gemini',
      1,
      'done',
      'workflow-1',
      3,
      NOW,
      NOW,
    ],
  );
  await db.execute(
    `INSERT INTO agents (
       id, session_id, step_id, ordinal, name, status, group_id, parallel_index,
       completed_at, last_finished_at
     ) VALUES ('agent-1', 'session-1', 'step-1', 0, 'Agent', 'completed', 'group-1', 4, ?, NULL)`,
    [ACTIVITY_AT],
  );
  await db.execute(
    `INSERT INTO session_workflows (
       workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, auto_run,
       discarded_at, created_at, goal, trigger_mode, chain_after_run_id, execution_mode,
       orchestration_outcome, orchestration_error, orchestrator_hints, orchestration_reason,
       orchestrator_provider, orchestrator_model, orchestrator_effort, step_provider, step_model,
       step_effort, orchestration_stop_kind, orchestrator_summary, spend_limit_usd,
       spend_limit_mode, role_model_overrides
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'run-1',
      'session-1',
      'workflow-1',
      0,
      2,
      1,
      null,
      ACTIVITY_AT,
      'Run goal',
      'manual',
      null,
      'dynamic',
      'next',
      'paused',
      'hint',
      'reason',
      'codex',
      'gpt-5.6',
      'high',
      'anthropic',
      'retired',
      'low',
      'operator',
      'summary',
      12.5,
      'stop',
      '{"planner":{"providerId":"codex","model":"gpt-5.6","effort":"high"}}',
    ],
  );
  await db.execute(
    `INSERT INTO parallel_groups (id, session_id, ordinal, merge_strategy, created_at)
     VALUES ('group-1', 'session-1', 0, 'last_write_wins', ?)`,
    [NOW],
  );
  await db.execute(
    `INSERT INTO messages (
       id, session_id, agent_id, role, content, provider_override_id,
       provider_override_model, created_at
     ) VALUES ('message-1', 'session-1', 'agent-1', 'user', 'hello', 'codex', 'gpt-5.6', ?)`,
    [NOW],
  );
  return db;
};

type TableInfoRow = {
  readonly name: string;
};

type DbParams = {
  readonly db: Database;
};

const columnsFor = async ({ db, table }: DbParams & { readonly table: string }) => {
  const rows = await db.select<TableInfoRow>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
};

describe('m122 runtime dead weight', () => {
  it('replaces the session payload and stores providers as JSON', async () => {
    const db = await seedThrough121();
    await migrate(db, migrations);

    const rows = await db.select<{
      readonly last_activity_at: number;
      readonly provider_enabled: string;
    }>("SELECT last_activity_at, provider_enabled FROM sessions WHERE id = 'session-1'");
    const columns = await columnsFor({ db, table: 'sessions' });

    expect(rows).toEqual([
      {
        last_activity_at: Date.parse(ACTIVITY_AT),
        provider_enabled: '["anthropic","codex","gemini"]',
      },
    ]);
    expect(columns).not.toContain('state_payload');
    expect(columns).not.toContain('skip_init');
    expect(columns).not.toContain('user_status');
    expect(columns).not.toContain('workflow_id');
  });

  it('consolidates agent completion and removes unused scheduling columns', async () => {
    const db = await seedThrough121();
    await migrate(db, migrations);

    const rows = await db.select<{ readonly last_finished_at: number }>(
      "SELECT last_finished_at FROM agents WHERE id = 'agent-1'",
    );
    const columns = await columnsFor({ db, table: 'agents' });

    expect(rows).toEqual([{ last_finished_at: Date.parse(ACTIVITY_AT) }]);
    expect(columns).not.toContain('completed_at');
    expect(columns).not.toContain('group_id');
    expect(columns).not.toContain('parallel_index');
  });

  it('drops parallel-group storage and retired workflow and message fields', async () => {
    const db = await seedThrough121();
    await migrate(db, migrations);

    const tables = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'parallel_groups'",
    );

    expect(tables).toEqual([]);
    expect(await columnsFor({ db, table: 'steps' })).not.toContain('parallel_group');
    expect(await columnsFor({ db, table: 'session_workflows' })).not.toContain('step_provider');
    expect(await columnsFor({ db, table: 'messages' })).not.toContain('provider_override_id');
    expect(await db.select<{ readonly rowid: number }>('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('preserves every surviving workflow-run field through reordering', async () => {
    const db = await seedThrough121();
    await migrate(db, migrations);

    await updateWorkflowOrder(
      db,
      'session-1' as never,
      ['run-1' as WorkflowRunId],
      ACTIVITY_AT as never,
    );
    const rows = await db.select<Record<string, unknown>>(
      `SELECT current_step_ordinal, auto_run, goal, trigger_mode, execution_mode,
              orchestration_outcome, orchestration_error, orchestrator_hints,
              orchestration_reason, orchestrator_provider, orchestrator_model,
              orchestrator_effort, orchestration_stop_kind, orchestrator_summary,
              spend_limit_usd, spend_limit_mode, role_model_overrides, created_at
       FROM session_workflows WHERE workflow_run_id = 'run-1'`,
    );

    expect(rows).toEqual([
      {
        current_step_ordinal: 2,
        auto_run: 1,
        goal: 'Run goal',
        trigger_mode: 'manual',
        execution_mode: 'dynamic',
        orchestration_outcome: 'next',
        orchestration_error: 'paused',
        orchestrator_hints: 'hint',
        orchestration_reason: 'reason',
        orchestrator_provider: 'codex',
        orchestrator_model: 'gpt-5.6',
        orchestrator_effort: 'high',
        orchestration_stop_kind: 'operator',
        orchestrator_summary: 'summary',
        spend_limit_usd: 12.5,
        spend_limit_mode: 'stop',
        role_model_overrides:
          '{"planner":{"providerId":"codex","model":"gpt-5.6","effort":"high"}}',
        created_at: Date.parse(ACTIVITY_AT),
      },
    ]);
  });
});
