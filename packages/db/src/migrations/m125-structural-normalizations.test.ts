import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const ISO_AT = '2026-08-22T10:20:30.456Z';
const SQLITE_AT = '2026-08-22 10:20:30';
const ISO_MS = Date.parse(ISO_AT);
const SQLITE_MS = Date.parse(`${SQLITE_AT}Z`);
const EPOCH_SECONDS = Math.floor(ISO_MS / 1000);

const seedThrough124 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 124),
  );
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'Workspace', 'workspace', ?, ?)`,
    [ISO_MS, ISO_MS],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'Goal', 'idle', ?, ?)`,
    [ISO_MS, ISO_MS],
  );
  await db.execute(
    `INSERT INTO workflows (
       id, workspace_id, name, description, created_at, updated_at, deleted_at
     ) VALUES ('workflow-1', 'workspace-1', 'Workflow', '', ?, ?, ?)`,
    [ISO_AT, SQLITE_AT, EPOCH_SECONDS],
  );
  await db.execute(
    `INSERT INTO workflows (
       id, workspace_id, name, description, created_at, updated_at, deleted_at
     ) VALUES ('workflow-ms', 'workspace-1', 'Workflow ms', '', ?, ?, ?)`,
    [SQLITE_AT, ISO_AT, ISO_MS],
  );
  await db.execute(
    `INSERT INTO step_library (
       id, workspace_id, role, name, prompt_prefix, created_at, updated_at, deleted_at
     ) VALUES ('library-1', 'workspace-1', 'custom', 'Library', '', ?, ?, ?)`,
    [ISO_AT, SQLITE_AT, EPOCH_SECONDS],
  );
  await db.execute(
    `INSERT INTO steps (
       id, workflow_id, library_step_id, ordinal, name, prompt_prefix, deleted_at
     ) VALUES ('step-1', 'workflow-1', 'library-1', 0, 'Step', '', ?)`,
    [EPOCH_SECONDS],
  );
  await db.execute(
    `INSERT INTO session_workflows (
       workflow_run_id, session_id, workflow_id, ordinal, discarded_at, created_at,
       chain_after_run_id
     ) VALUES ('run-1', 'session-1', 'workflow-1', 0, ?, ?, 'missing-run')`,
    [ISO_AT, SQLITE_AT],
  );
  await db.execute(
    `INSERT INTO agents (
       id, session_id, ordinal, name, status, workflow_run_id, started_at,
       last_finished_at, last_viewed_at, done_at
     ) VALUES ('agent-1', 'session-1', 0, 'Agent', 'completed', 'missing-run', ?, ?, ?, ?)`,
    [ISO_AT, SQLITE_AT, ISO_AT, SQLITE_AT],
  );
  await db.execute(
    `INSERT INTO open_questions (
       id, session_id, text, created_at, workflow_run_id
     ) VALUES ('question-1', 'session-1', 'Question?', ?, 'missing-run')`,
    [ISO_MS],
  );
  await db.execute(
    `INSERT INTO session_plans (
       id, session_id, agent_id, title, body_md, status, created_at, updated_at,
       workflow_run_id
     ) VALUES (
       'plan-1', 'session-1', 'agent-1', 'Plan', 'Body', 'active', ?, ?, 'missing-run'
     )`,
    [ISO_MS, ISO_MS],
  );
  await db.execute(
    `INSERT INTO file_versions (
       id, session_id, relative_path, stored_name, size_bytes, content_hash,
       change_kind, snapshot_source, provider_run_id, captured_at
     ) VALUES (
       'version-1', 'session-1', 'a.ts', 'stored', 1, 'hash', 'modified',
       'agent_turn', 'missing-provider-run', ?
     )`,
    [ISO_MS],
  );
  await db.execute(
    `INSERT INTO provider_runs (
       id, session_id, provider, model, status_kind, status_payload, created_at
     ) VALUES (
       'provider-run-stream', 'session-1', 'codex', 'model', 'streaming', ?, ?
     )`,
    [JSON.stringify({ startedAt: ISO_AT }), ISO_MS],
  );
  await db.execute(
    `INSERT INTO provider_runs (
       id, session_id, provider, model, status_kind, status_payload, created_at
     ) VALUES (
       'provider-run-done', 'session-1', 'codex', 'model', 'succeeded', ?, ?
     )`,
    [JSON.stringify({ finishedAt: SQLITE_AT }), ISO_MS],
  );
  await db.execute(
    `INSERT INTO goal_attachments (
       id, owner_type, owner_id, rel_path, kind, file_name, mime_type, created_at
     ) VALUES (
       'attachment-session', 'session', 'session-1', '.goodboy/attachments/session.png',
       'image', 'session.png', 'image/png', ?
     )`,
    [ISO_MS],
  );
  await db.execute(
    `INSERT INTO goal_attachments (
       id, owner_type, owner_id, rel_path, kind, file_name, mime_type, created_at
     ) VALUES (
       'attachment-run', 'workflow_run', 'run-1', '.goodboy/attachments/run.png',
       'image', 'run.png', 'image/png', ?
     )`,
    [ISO_MS],
  );
  await db.execute(
    `INSERT INTO goal_attachments (
       id, owner_type, owner_id, rel_path, kind, file_name, mime_type, created_at
     ) VALUES (
       'attachment-orphan', 'session', 'missing-session', '.goodboy/attachments/orphan.png',
       'image', 'orphan.png', 'image/png', ?
     )`,
    [ISO_MS],
  );
  await db.execute(
    `INSERT INTO nudge_events (id, ts, kind, context_json, outcome, outcome_ts)
     VALUES ('nudge-1', ?, 'scope', ?, 'accepted', ?)`,
    [ISO_AT, JSON.stringify({ sessionId: 'session-1' }), SQLITE_AT],
  );
  await db.execute(
    `INSERT INTO budget_rules (id, provider, cap_usd, created_at)
     VALUES ('budget-rule-1', 'codex', 10, ?)`,
    [ISO_AT],
  );
  await db.execute(
    `INSERT INTO budget_alerts (
       id, kind, provider, current_usd, cap_usd, created_at, dismissed_at
     ) VALUES ('budget-alert-1', 'provider-threshold', 'codex', 8, 10, ?, ?)`,
    [SQLITE_AT, ISO_AT],
  );
  await db.execute(
    `INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at)
     VALUES ('branch', 'owner/repo', '{}', ?)`,
    [ISO_AT],
  );
  await db.execute(
    `INSERT INTO notifications (id, ts, kind, title, session_id, workspace_id)
     VALUES ('notification-1', ?, 'agent', 'Done', 'session-1', 'workspace-1')`,
    [SQLITE_AT],
  );
  await db.execute(
    `INSERT INTO permission_rules (
       id, scope, pattern_tool, decision, created_at, updated_at
     ) VALUES ('rule-1', 'global', 'Bash', 'allow', ?, ?)`,
    [ISO_AT, SQLITE_AT],
  );
  await db.execute(
    `INSERT INTO permission_audit_log (
       id, run_id, session_id, tool_use_id, tool_name, input_json, decision,
       decided_by, requested_at, decided_at
     ) VALUES (
       'audit-1', 'run', 'session-1', 'tool-use', 'Bash', '{}', 'allow', 'user', ?, ?
     )`,
    [SQLITE_AT, ISO_AT],
  );
  await db.execute(
    `INSERT INTO pr_review_drafts (
       id, session_id, provider, repo, pr_number, path, line, body, created_at
     ) VALUES ('draft-1', 'session-1', 'github', 'owner/repo', 1, 'a.ts', 1, 'Body', ?)`,
    [ISO_AT],
  );
  await db.execute(
    `INSERT INTO skills (
       id, workspace_id, name, description, file_path, body, frontmatter_json,
       created_at, updated_at
     ) VALUES ('skill-1', 'workspace-1', 'Skill', '', 'SKILL.md', '', '{}', ?, ?)`,
    [SQLITE_AT, ISO_AT],
  );
  return db;
};

type TimestampColumnRow = {
  readonly table_name: string;
  readonly column_name: string;
  readonly type: string;
};

describe('m125 through m129 structural normalizations', () => {
  it('converts every schema timestamp to epoch milliseconds without double conversion', async () => {
    const db = await seedThrough124();
    await migrate(db, migrations);

    const timestampColumns = await db.select<TimestampColumnRow>(
      `SELECT sqlite_master.name AS table_name, pragma_table_info.name AS column_name,
              pragma_table_info.type AS type
       FROM sqlite_master
       JOIN pragma_table_info(sqlite_master.name)
       WHERE sqlite_master.type = 'table'
         AND (
           pragma_table_info.name = 'ts'
           OR pragma_table_info.name LIKE '%!_at' ESCAPE '!'
         )
       ORDER BY sqlite_master.name, pragma_table_info.name`,
    );
    expect(timestampColumns.filter((column) => column.type !== 'INTEGER')).toEqual([]);

    const workflowRows = await db.select<{
      readonly id: string;
      readonly created_at: number;
      readonly updated_at: number;
      readonly deleted_at: number;
    }>('SELECT id, created_at, updated_at, deleted_at FROM workflows ORDER BY id');
    expect(workflowRows).toEqual([
      {
        id: 'workflow-1',
        created_at: ISO_MS,
        updated_at: SQLITE_MS,
        deleted_at: EPOCH_SECONDS * 1000,
      },
      {
        id: 'workflow-ms',
        created_at: SQLITE_MS,
        updated_at: ISO_MS,
        deleted_at: ISO_MS,
      },
    ]);
    const schemaRows = await db.select<{ readonly sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL",
    );
    expect(schemaRows.some((row) => row.sql.includes("datetime('now')"))).toBe(false);
    const providerTimestamps = await db.select<{
      readonly id: string;
      readonly timestamp: number;
      readonly timestamp_type: string;
    }>(
      `SELECT id,
              COALESCE(
                json_extract(status_payload, '$.startedAt'),
                json_extract(status_payload, '$.finishedAt')
              ) AS timestamp,
              COALESCE(
                json_type(status_payload, '$.startedAt'),
                json_type(status_payload, '$.finishedAt')
              ) AS timestamp_type
       FROM provider_runs
       ORDER BY id`,
    );
    expect(providerTimestamps).toEqual([
      { id: 'provider-run-done', timestamp: SQLITE_MS, timestamp_type: 'integer' },
      { id: 'provider-run-stream', timestamp: ISO_MS, timestamp_type: 'integer' },
    ]);
  });

  it('adds unconstrained providers, real owner keys, reference keys, and impact indexes', async () => {
    const db = await seedThrough124();
    await migrate(db, migrations);

    const attachmentRows = await db.select<{
      readonly id: string;
      readonly session_id: string | null;
      readonly workflow_run_id: string | null;
    }>('SELECT id, session_id, workflow_run_id FROM goal_attachments ORDER BY id');
    expect(attachmentRows).toEqual([
      { id: 'attachment-run', session_id: null, workflow_run_id: 'run-1' },
      { id: 'attachment-session', session_id: 'session-1', workflow_run_id: null },
    ]);

    const nudgeRows = await db.select<{
      readonly session_id: string | null;
      readonly created_at: number;
      readonly outcome_ts: number | null;
    }>('SELECT session_id, created_at, outcome_ts FROM nudge_events');
    expect(nudgeRows).toEqual([
      { session_id: 'session-1', created_at: ISO_MS, outcome_ts: SQLITE_MS },
    ]);

    const danglingRows = await db.select<{
      readonly agent_run: string | null;
      readonly question_run: string | null;
      readonly plan_run: string | null;
      readonly chain_run: string | null;
      readonly provider_run: string | null;
    }>(
      `SELECT a.workflow_run_id AS agent_run, q.workflow_run_id AS question_run,
              p.workflow_run_id AS plan_run, sw.chain_after_run_id AS chain_run,
              fv.provider_run_id AS provider_run
       FROM agents a
       JOIN open_questions q ON q.session_id = a.session_id
       JOIN session_plans p ON p.agent_id = a.id
       JOIN session_workflows sw ON sw.session_id = a.session_id
       JOIN file_versions fv ON fv.session_id = a.session_id`,
    );
    expect(danglingRows).toEqual([
      {
        agent_run: null,
        question_run: null,
        plan_run: null,
        chain_run: null,
        provider_run: null,
      },
    ]);

    const tableRows = await db.select<{ readonly name: string; readonly sql: string }>(
      `SELECT name, sql FROM sqlite_master
       WHERE type = 'table' AND name IN ('provider_runs', 'session_external_tasks')
       ORDER BY name`,
    );
    expect(tableRows.every((row) => !row.sql.includes('provider IN'))).toBe(true);
    await db.execute(
      `INSERT INTO provider_runs (
         id, session_id, provider, model, status_kind, status_payload, created_at
       ) VALUES ('provider-run-new', 'session-1', 'future-provider', 'model', 'pending', '{}', ?)`,
      [ISO_MS],
    );
    await db.execute(
      `INSERT INTO session_external_tasks (
         session_id, provider, external_id, identifier, url, title, created_at
       ) VALUES (
         'session-1', 'future-provider', 'external', 'EXT-1', 'https://example.test', 'Task', ?
       )`,
      [ISO_MS],
    );

    const indexes = await db.select<{ readonly name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'index' AND name IN (
         'idx_permission_audit_session_requested_at',
         'idx_notifications_ts',
         'idx_telemetry_provider',
         'idx_diff_comments_session_created_at',
         'idx_skills_workspace_created_at',
         'idx_github_pr_cache_branch'
       )
       ORDER BY name`,
    );
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_diff_comments_session_created_at',
      'idx_notifications_ts',
      'idx_permission_audit_session_requested_at',
      'idx_skills_workspace_created_at',
      'idx_telemetry_provider',
    ]);
    expect(await db.select<{ readonly rowid: number }>('PRAGMA foreign_key_check')).toEqual([]);
  });
});
