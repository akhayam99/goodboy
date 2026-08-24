import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { migrate } from '../migrations/runner';
import { makeTestDatabase } from '../test-helpers/test-db';
import { runDatabaseHygiene } from './runDatabaseHygiene';

const NOW = Date.UTC(2026, 7, 22, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

const seedSession = async ({ db }: { readonly db: Database }): Promise<void> => {
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES ('workspace-1', 'workspace', 'workspace', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES ('session-1', 'workspace-1', 'goal', 'idle', ?, ?)`,
    [NOW, NOW],
  );
  await db.execute(
    `INSERT INTO agents (id, session_id, ordinal, name, status)
     VALUES ('agent-1', 'session-1', 0, 'agent', 'pending')`,
  );
};

describe('runDatabaseHygiene', () => {
  it('cancels only stale in-flight provider runs through the status updater', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    await seedSession({ db });
    await db.execute(
      `INSERT INTO provider_runs
         (id, session_id, provider, model, status_kind, status_payload, created_at)
       VALUES
         ('old-stream', 'session-1', 'anthropic', 'model', 'streaming', '{"routingDecision":{"provider":"anthropic","model":"model","reason":"session-default"}}', ?),
         ('recent-pending', 'session-1', 'anthropic', 'model', 'pending', '{}', ?),
         ('old-success', 'session-1', 'anthropic', 'model', 'succeeded', '{}', ?)`,
      [NOW - 2 * DAY_MS, NOW - 60 * 60 * 1000, NOW - 2 * DAY_MS],
    );

    const result = await runDatabaseHygiene({ db, now: NOW });
    const rows = await db.select<{
      id: string;
      status_kind: string;
      status_payload: string;
    }>('SELECT id, status_kind, status_payload FROM provider_runs ORDER BY id');

    expect(result.providerRunsCancelled).toBe(1);
    expect(rows.map((row) => [row.id, row.status_kind])).toEqual([
      ['old-stream', 'cancelled'],
      ['old-success', 'succeeded'],
      ['recent-pending', 'pending'],
    ]);
    expect(JSON.parse(rows[0]?.status_payload ?? '{}')).toMatchObject({
      finishedAt: NOW,
      routingDecision: { provider: 'anthropic' },
    });
  });

  it('does not cancel a stale run that finishes after zombie selection', async () => {
    const sourceDb = makeTestDatabase();
    await migrate(sourceDb);
    await seedSession({ db: sourceDb });
    await sourceDb.execute(
      `INSERT INTO provider_runs
         (id, session_id, provider, model, status_kind, status_payload, created_at)
       VALUES
         ('racing-run', 'session-1', 'anthropic', 'model', 'streaming', '{}', ?)`,
      [NOW - 2 * DAY_MS],
    );
    let hasFinishedRun = false;
    const db: Database = {
      exec: (sql) => sourceDb.exec(sql),
      execute: (sql, params) => sourceDb.execute(sql, params),
      select: async <Row>(sql: string, params?: ReadonlyArray<unknown>) => {
        const rows = await sourceDb.select<Row>(sql, params);
        if (sql.includes('SELECT id FROM provider_runs') && hasFinishedRun === false) {
          hasFinishedRun = true;
          await sourceDb.execute(
            `UPDATE provider_runs
             SET status_kind = 'succeeded', status_payload = '{"finishedAt":"provider-finished"}'
             WHERE id = 'racing-run'`,
          );
        }
        return rows;
      },
    };

    const result = await runDatabaseHygiene({ db, now: NOW });
    const rows = await sourceDb.select<{ status_kind: string; status_payload: string }>(
      "SELECT status_kind, status_payload FROM provider_runs WHERE id = 'racing-run'",
    );

    expect(result.providerRunsCancelled).toBe(0);
    expect(rows).toEqual([
      { status_kind: 'succeeded', status_payload: '{"finishedAt":"provider-finished"}' },
    ]);
  });

  it('removes expired audit events, old turn events, and orphaned PR cache rows', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    await seedSession({ db });
    await db.execute(
      `INSERT INTO session_worktrees
         (id, session_id, worktree_path, branch, parallel_index, repo_slug, created_at)
       VALUES
         ('worktree-1', 'session-1', '/tmp/worktree', 'ak/live', 0, 'acme/repo', ?),
         ('worktree-2', 'session-1', '/tmp/unknown-repo', 'ak/unknown-repo', 1, NULL, ?)`,
      [NOW, NOW],
    );
    await db.execute(
      `INSERT INTO session_worktrees
         (id, session_id, worktree_path, branch, parallel_index, repo_slug, created_at)
       VALUES ('worktree-3', 'session-1', '/tmp/other-repo', 'ak/other-live', 2, 'other/repo', ?)`,
      [NOW],
    );
    await db.execute(
      `INSERT INTO permission_audit_log
         (id, run_id, session_id, tool_use_id, tool_name, input_json, decision, decided_by, requested_at, decided_at)
       VALUES
         ('old-audit', 'run', 'session-1', 'tool-old', 'Read', '{}', 'allow', 'user', ?, ?),
         ('new-audit', 'run', 'session-1', 'tool-new', 'Read', '{}', 'allow', 'user', ?, ?)`,
      [NOW - 31 * DAY_MS, NOW - 31 * DAY_MS, NOW, NOW],
    );
    await db.execute(
      `INSERT INTO turn_events (id, session_id, agent_id, payload, created_at)
       VALUES
         ('old-event', 'session-1', 'agent-1', '{}', ?),
         ('new-event', 'session-1', 'agent-1', '{}', ?)`,
      [NOW - 91 * DAY_MS, NOW],
    );
    await db.execute(
      `INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at)
       VALUES
         ('ak/live', 'acme/repo', NULL, ?),
         ('ak/live', 'other/repo', NULL, ?),
         ('ak/unknown-repo', 'acme/repo', NULL, ?),
         ('ak/other-live', 'acme/repo', NULL, ?),
         ('ak/orphan', 'acme/repo', NULL, ?)`,
      [NOW, NOW, NOW, NOW, NOW],
    );

    const result = await runDatabaseHygiene({ db, now: NOW });
    const auditRows = await db.select<{ id: string }>('SELECT id FROM permission_audit_log');
    const eventRows = await db.select<{ id: string }>('SELECT id FROM turn_events');
    const cacheRows = await db.select<{ branch: string; repo_slug: string }>(
      'SELECT branch, repo_slug FROM github_pr_cache',
    );

    expect(result).toMatchObject({
      permissionAuditRowsDeleted: 1,
      turnEventRowsDeleted: 1,
      githubPrCacheRowsDeleted: 4,
    });
    expect(auditRows).toEqual([{ id: 'new-audit' }]);
    expect(eventRows).toEqual([{ id: 'new-event' }]);
    expect(cacheRows).toEqual([{ branch: 'ak/live', repo_slug: 'acme/repo' }]);
  });

  it('caps audit and turn event tables to their newest rows', async () => {
    const db = makeTestDatabase();
    await migrate(db);
    await seedSession({ db });
    await db.execute(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1
         UNION ALL
         SELECT value + 1 FROM sequence WHERE value < 5001
       )
       INSERT INTO permission_audit_log
         (id, run_id, session_id, tool_use_id, tool_name, input_json, decision, decided_by, requested_at, decided_at)
       SELECT
         'audit-' || value,
         'run',
         'session-1',
         'tool-' || value,
         'Read',
         '{}',
         'allow',
         'user',
         ?,
         ?
       FROM sequence`,
      [NOW, NOW],
    );
    await db.execute(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1
         UNION ALL
         SELECT value + 1 FROM sequence WHERE value < 200001
       )
       INSERT INTO turn_events (id, session_id, agent_id, payload, created_at)
       SELECT 'event-' || value, 'session-1', 'agent-1', '{}', ?
       FROM sequence`,
      [NOW],
    );

    const result = await runDatabaseHygiene({ db, now: NOW });
    const auditCount = await db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM permission_audit_log',
    );
    const eventCount = await db.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM turn_events',
    );

    expect(result.permissionAuditRowsDeleted).toBe(1);
    expect(result.turnEventRowsDeleted).toBe(1);
    expect(auditCount[0]?.count).toBe(5000);
    expect(eventCount[0]?.count).toBe(200_000);
  });
});
