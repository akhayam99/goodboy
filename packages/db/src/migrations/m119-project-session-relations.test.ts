import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  foreignKeyViolations,
  insertRow,
  migrateThrough,
  selectRows,
  type Row,
} from '../test-helpers/migration-rows';

const NOW = 1_775_000_000_000;

const CHILD_TABLES: ReadonlyArray<{ readonly table: string; readonly orderBy: string }> = [
  { table: 'agents', orderBy: 'id' },
  { table: 'session_events', orderBy: 'id' },
  { table: 'session_worktrees', orderBy: 'id' },
  { table: 'session_external_tasks', orderBy: 'external_id' },
  { table: 'session_workflows', orderBy: 'workflow_run_id' },
  { table: 'open_questions', orderBy: 'id' },
  { table: 'session_plans', orderBy: 'id' },
  { table: 'provider_runs', orderBy: 'id' },
  { table: 'file_versions', orderBy: 'id' },
  { table: 'workflows', orderBy: 'id' },
];

const seedThrough118 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 118 });
  await db.exec('PRAGMA foreign_keys = OFF');
  await insertRow({
    db,
    table: 'workspaces',
    row: {
      id: 'workspace-harborline',
      name: 'Harborline',
      slug: 'harborline',
      created_at: NOW - 5000,
      updated_at: NOW - 4000,
    },
  });
  await insertRow({
    db,
    table: 'projects',
    row: {
      id: 'project-ledger-core',
      workspace_id: 'workspace-harborline',
      name: 'ledger-core',
      root_path: '/fixture/ledger-core',
      default_provider_id: 'codex',
      default_workflow_id: 'workflow-review',
      default_branch_prefix: 'ak/',
      parallel_enabled: 1,
      created_at: NOW - 3000,
      updated_at: NOW - 2000,
      deleted_at: null,
      disconnected_at: NOW - 1500,
      default_verbosity: 'verbose',
      last_accessed_at: NOW - 1000,
      provider_bindings: '{"codex":"account-a"}',
      scout_fanout: 3,
      kind: 'repo',
      task_models: '{"plan":"model-a"}',
      role_models: '{"reviewer":"model-b"}',
      provider_pool: '["codex","gemini"]',
    },
  });
  await insertRow({
    db,
    table: 'projects',
    row: {
      id: 'project-notes',
      workspace_id: 'workspace-harborline',
      name: 'notes',
      root_path: '/fixture/notes',
      parallel_enabled: 0,
      created_at: NOW - 3000,
      updated_at: NOW - 2000,
      deleted_at: NOW - 500,
      kind: 'simple',
    },
  });
  await insertRow({
    db,
    table: 'sessions',
    row: {
      id: 'session-full',
      workspace_id: 'workspace-harborline',
      goal: 'Reconcile the ledger',
      state_kind: 'running',
      state_payload: '{"lastActivityAt":"2026-04-01T10:20:30.456Z"}',
      provider_default: 'codex',
      provider_allow_override: 0,
      workflow_id: 'workflow-review',
      current_step_ordinal: 2,
      default_provider_id: 'gemini',
      default_workflow_id: 'workflow-review',
      default_branch_prefix: 'fix/',
      parallel_enabled: 1,
      created_at: NOW - 900,
      updated_at: NOW - 800,
      permission_mode: 'default',
      auto_run: 1,
      title_user_edited: 1,
      archived_at: null,
      deleted_at: null,
      verbosity: 'brief',
      effort: 'high',
      model_override: 'model-x',
      provider_override: 'codex',
      user_status: 'done',
      skip_init: 1,
      provider_bindings: '{"codex":"account-b"}',
      provider_enabled: 'codex,gemini',
      active_mount_workspace_id: 'project-ledger-core',
    },
  });
  await insertRow({
    db,
    table: 'sessions',
    row: {
      id: 'session-archived',
      workspace_id: 'workspace-harborline',
      goal: 'Old goal',
      state_kind: 'ended',
      created_at: NOW - 700,
      updated_at: NOW - 600,
      archived_at: NOW - 100,
    },
  });
  await insertRow({
    db,
    table: 'workflows',
    row: {
      id: 'workflow-review',
      workspace_id: 'workspace-harborline',
      name: 'Review',
      created_at: NOW - 900,
      updated_at: NOW - 800,
    },
  });
  await insertRow({
    db,
    table: 'session_workflows',
    row: {
      workflow_run_id: 'run-1',
      session_id: 'session-full',
      workflow_id: 'workflow-review',
      ordinal: 0,
      created_at: NOW - 700,
      goal: 'Run goal',
    },
  });
  await insertRow({
    db,
    table: 'agents',
    row: {
      id: 'agent-1',
      session_id: 'session-full',
      ordinal: 0,
      name: 'Planner',
      status: 'completed',
      workflow_run_id: 'run-1',
      output_summary: 'planned',
    },
  });
  await insertRow({
    db,
    table: 'agents',
    row: { id: 'agent-2', session_id: 'session-archived', ordinal: 0, name: 'Old', status: 'done' },
  });
  await insertRow({
    db,
    table: 'session_events',
    row: {
      id: 'event-1',
      session_id: 'session-full',
      kind: 'branch_created',
      payload_json: '{"branch":"ak/fix"}',
      created_at: NOW - 650,
    },
  });
  await insertRow({
    db,
    table: 'session_worktrees',
    row: {
      id: 'worktree-1',
      session_id: 'session-full',
      worktree_path: '/worktrees/session-full/ledger-core',
      branch: 'ak/fix',
      parallel_index: 1,
      created_at: NOW - 640,
      mount_workspace_id: 'project-ledger-core',
      mount_name: 'ledger-core',
      repo_slug: 'harborline/ledger-core',
    },
  });
  await insertRow({
    db,
    table: 'session_external_tasks',
    row: {
      session_id: 'session-full',
      mount_workspace_id: 'project-ledger-core',
      provider: 'github',
      external_id: '42',
      identifier: 'HB-42',
      url: 'https://example.test/42',
      title: 'Fix the ledger',
      created_at: NOW - 630,
      branch: 'ak/fix',
    },
  });
  await insertRow({
    db,
    table: 'open_questions',
    row: {
      id: 'question-1',
      session_id: 'session-full',
      text: 'Which account?',
      suggested_answers: '["a","b"]',
      status: 'answered',
      user_answer: 'a',
      created_at: NOW - 620,
      answered_at: NOW - 610,
      created_by_agent_id: 'agent-1',
      workflow_run_id: 'run-1',
    },
  });
  await insertRow({
    db,
    table: 'session_plans',
    row: {
      id: 'plan-1',
      session_id: 'session-full',
      agent_id: 'agent-1',
      title: 'Plan',
      body_md: '# Plan',
      status: 'active',
      created_at: NOW - 600,
      updated_at: NOW - 590,
    },
  });
  await insertRow({
    db,
    table: 'provider_runs',
    row: {
      id: 'provider-run-1',
      session_id: 'session-full',
      provider: 'codex',
      model: 'model-x',
      status_kind: 'succeeded',
      status_payload: '{"finishedAt":1}',
      created_at: NOW - 580,
    },
  });
  await insertRow({
    db,
    table: 'file_versions',
    row: {
      id: 'version-1',
      session_id: 'session-full',
      relative_path: 'src/ledger.ts',
      stored_name: 'stored-1',
      size_bytes: 12,
      content_hash: 'hash-1',
      change_kind: 'modified',
      snapshot_source: 'agent_turn',
      provider_run_id: 'provider-run-1',
      captured_at: NOW - 570,
    },
  });
  await db.exec('PRAGMA foreign_keys = ON');
  return db;
};

const withoutKey = ({ row, key }: { readonly row: Row; readonly key: string }): Row =>
  Object.fromEntries(Object.entries(row).filter(([name]) => name !== key));

describe('m119 project and session relations', () => {
  it('keeps every session column and renames the active mount to the active project', async () => {
    const db = await seedThrough118();
    const before = await selectRows({ db, table: 'sessions', orderBy: 'id' });

    await migrateThrough({ db, version: 119 });
    const after = await selectRows({ db, table: 'sessions', orderBy: 'id' });

    expect(after).toEqual(
      before.map((row) => ({
        ...withoutKey({ row, key: 'active_mount_workspace_id' }),
        active_project_id: row['active_mount_workspace_id'],
      })),
    );
    expect(after.find((row) => row['id'] === 'session-full')).toMatchObject({
      active_project_id: 'project-ledger-core',
      provider_enabled: 'codex,gemini',
      effort: 'high',
      skip_init: 1,
    });
  });

  it('keeps every project column and turns the simple kind into folder', async () => {
    const db = await seedThrough118();
    const before = await selectRows({ db, table: 'projects', orderBy: 'id' });

    await migrateThrough({ db, version: 119 });
    const after = await selectRows({ db, table: 'projects', orderBy: 'id' });

    expect(after).toEqual(
      before.map((row) => ({ ...row, kind: row['kind'] === 'simple' ? 'folder' : row['kind'] })),
    );
    expect(after.map((row) => row['kind'])).toEqual(['repo', 'folder']);
  });

  it.each(CHILD_TABLES)('leaves the $table rows of rebuilt sessions untouched', async (child) => {
    const db = await seedThrough118();
    const before = await selectRows({ db, ...child });

    await migrateThrough({ db, version: 119 });
    const after = await selectRows({ db, ...child });

    expect(before.length).toBeGreaterThan(0);
    expect(after).toEqual(before);
  });

  it('leaves no dangling foreign key and points sessions at workspaces', async () => {
    const db = await seedThrough118();

    await migrateThrough({ db, version: 119 });
    const keys = await db.select<{ readonly table: string; readonly from: string }>(
      'PRAGMA foreign_key_list(sessions)',
    );

    expect(await foreignKeyViolations(db)).toEqual([]);
    expect(keys.map((key) => ({ table: key.table, from: key.from }))).toEqual([
      { table: 'workspaces', from: 'workspace_id' },
    ]);
  });

  it('still cascades a session delete into the child rows', async () => {
    const db = await seedThrough118();

    await migrateThrough({ db, version: 119 });
    await db.execute("DELETE FROM sessions WHERE id = 'session-full'");
    const remaining = await db.select<{ readonly total: number }>(
      `SELECT
         (SELECT COUNT(*) FROM agents WHERE session_id = 'session-full')
         + (SELECT COUNT(*) FROM session_events WHERE session_id = 'session-full')
         + (SELECT COUNT(*) FROM session_worktrees WHERE session_id = 'session-full')
         + (SELECT COUNT(*) FROM session_plans WHERE session_id = 'session-full') AS total`,
    );
    const other = await db.select<{ readonly id: string }>('SELECT id FROM agents');

    expect(remaining[0]?.total).toBe(0);
    expect(other).toEqual([{ id: 'agent-2' }]);
  });
});
