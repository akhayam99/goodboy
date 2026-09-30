import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';

type Lookup = {
  readonly table: string;
  readonly column: string;
};

type DroppedIndex = Lookup & {
  readonly dropped: string;
  readonly servedBy: string;
};

type AddedIndex = Lookup & {
  readonly added: string;
};

const DROPPED: ReadonlyArray<DroppedIndex> = [
  {
    dropped: 'idx_agents_session_id',
    table: 'agents',
    column: 'session_id',
    servedBy: 'idx_agents_unread',
  },
  {
    dropped: 'idx_mount_operations_session_id',
    table: 'mount_operations',
    column: 'session_id',
    servedBy: 'sqlite_autoindex_mount_operations_2',
  },
  {
    dropped: 'idx_mount_pr_links_mount_id',
    table: 'mount_pr_links',
    column: 'mount_id',
    servedBy: 'sqlite_autoindex_mount_pr_links_2',
  },
  {
    dropped: 'idx_permission_audit_session_id',
    table: 'permission_audit_log',
    column: 'session_id',
    servedBy: 'idx_permission_audit_session_requested_at',
  },
  {
    dropped: 'idx_pr_series_session_id',
    table: 'pr_series',
    column: 'session_id',
    servedBy: 'idx_pr_series_name',
  },
  {
    dropped: 'idx_security_findings_workspace',
    table: 'security_findings',
    column: 'workspace_id',
    servedBy: 'idx_security_findings_identity',
  },
  {
    dropped: 'idx_session_artifacts_agent_id',
    table: 'session_artifacts',
    column: 'agent_id',
    servedBy: 'sqlite_autoindex_session_artifacts_3',
  },
  {
    dropped: 'idx_session_worktrees_session_id',
    table: 'session_worktrees',
    column: 'session_id',
    servedBy: 'idx_session_worktrees_session_attached',
  },
  {
    dropped: 'idx_skills_workspace_id',
    table: 'skills',
    column: 'workspace_id',
    servedBy: 'idx_skills_workspace_created_at',
  },
];

const ADDED: ReadonlyArray<AddedIndex> = [
  {
    added: 'idx_deleted_branches_workspace_id',
    table: 'deleted_branches',
    column: 'workspace_id',
  },
  {
    added: 'idx_integration_bindings_project_id',
    table: 'integration_bindings',
    column: 'project_id',
  },
  {
    added: 'idx_open_questions_answered_by_agent_id',
    table: 'open_questions',
    column: 'answered_by_agent_id',
  },
  {
    added: 'idx_resolve_threads_reopened_from_thread_id',
    table: 'resolve_threads',
    column: 'reopened_from_thread_id',
  },
  {
    added: 'idx_security_findings_project_id',
    table: 'security_findings',
    column: 'project_id',
  },
  { added: 'idx_steps_library_step_id', table: 'steps', column: 'library_step_id' },
];

const planOf = async ({
  db,
  table,
  column,
}: Lookup & { readonly db: Database }): Promise<string> => {
  const rows = await db.select<{ readonly detail: string }>(
    `EXPLAIN QUERY PLAN SELECT * FROM ${table} WHERE ${column} = ?`,
    ['harborline'],
  );
  return rows.map((row) => row.detail).join(' ; ');
};

const indexNames = async ({ db }: { readonly db: Database }): Promise<ReadonlySet<string>> => {
  const rows = await db.select<{ readonly name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index'",
  );
  return new Set(rows.map((row) => row.name));
};

describe('m215 index audit', () => {
  it.each(DROPPED)(
    'drops $dropped and $table on $column is still searched by $servedBy',
    async ({ dropped, table, column, servedBy }) => {
      const db = await makeMigratedTestDatabase();
      expect(await indexNames({ db })).not.toContain(dropped);
      const plan = await planOf({ db, table, column });
      expect(plan).toContain(`SEARCH ${table} USING INDEX ${servedBy} (${column}=?)`);
    },
  );

  it.each(DROPPED)('had $dropped in place before the migration', async ({ dropped }) => {
    const db = await makeMigratedTestDatabase({ throughVersion: 214 });
    expect(await indexNames({ db })).toContain(dropped);
  });

  it.each(ADDED)('searches $table on $column through $added', async ({ added, table, column }) => {
    const db = await makeMigratedTestDatabase();
    const plan = await planOf({ db, table, column });
    expect(plan).toContain(`SEARCH ${table} USING INDEX ${added} (${column}=?)`);
  });

  it.each(ADDED)('scanned $table on $column before the migration', async ({ table, column }) => {
    const db = await makeMigratedTestDatabase({ throughVersion: 214 });
    const plan = await planOf({ db, table, column });
    expect(plan).toContain(`SCAN ${table}`);
  });

  it('keeps every row and a healthy schema', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 214 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('harborline', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('ledger', 'harborline', 'Close the ledger', 'idle', 1, 1)",
    );
    await db.execute(
      "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent-1', 'ledger', 0, 'Agent', 'completed')",
    );
    await db.execute(
      "INSERT INTO skills (id, workspace_id, name, description, file_path, body, frontmatter_json, created_at, updated_at) VALUES ('skill-1', 'harborline', 'Reconcile', 'Match payouts to the ledger', '/skills/reconcile.md', 'Match payouts.', '{}', 1, 1)",
    );
    const result = await migrate(db);
    expect(result.applied).toEqual([215]);
    const agents = await db.select<{ readonly id: string }>('SELECT id FROM agents');
    const skills = await db.select<{ readonly id: string }>('SELECT id FROM skills');
    expect(agents).toEqual([{ id: 'agent-1' }]);
    expect(skills).toEqual([{ id: 'skill-1' }]);
    const integrity = await db.select<{ readonly integrity_check: string }>(
      'PRAGMA integrity_check',
    );
    expect(integrity).toEqual([{ integrity_check: 'ok' }]);
    expect(await db.select('PRAGMA foreign_key_check')).toEqual([]);
  });
});
