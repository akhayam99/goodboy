import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';

type RuleColumn = 'id' | 'created_at' | 'updated_at';

const EXEMPT_FROM_BASE_COLUMNS: Readonly<Record<string, ReadonlyArray<RuleColumn>>> = {
  agent_handoffs: ['id', 'updated_at'],
  agent_queued_messages: ['updated_at'],
  agent_turn_spans: ['id', 'created_at', 'updated_at'],
  agents: ['created_at', 'updated_at'],
  artifact_provenance: ['id', 'updated_at'],
  artifact_revisions: ['id', 'updated_at'],
  auto_artifact_versions: ['id', 'updated_at'],
  auto_artifacts: ['id', 'updated_at'],
  auto_attempts: ['created_at', 'updated_at'],
  auto_delegations: ['updated_at'],
  auto_outbox: ['updated_at'],
  budget_alerts: ['updated_at'],
  budget_rules: ['updated_at'],
  chat_message_attachments: ['updated_at'],
  chat_session_links: ['updated_at'],
  context_slot_history: ['updated_at'],
  context_slots: ['id', 'created_at', 'updated_at'],
  deleted_branches: ['created_at', 'updated_at'],
  diff_comments: ['updated_at'],
  file_versions: ['created_at', 'updated_at'],
  github_pr_cache: ['id', 'created_at', 'updated_at'],
  goal_attachments: ['updated_at'],
  messages: ['updated_at'],
  notifications: ['created_at', 'updated_at'],
  nudge_events: ['updated_at'],
  open_questions: ['updated_at'],
  permission_audit_log: ['created_at', 'updated_at'],
  plan_consumptions: ['created_at', 'updated_at'],
  pr_review_drafts: ['updated_at'],
  project_sentry_links: ['updated_at'],
  project_values: ['id', 'created_at'],
  provider_credentials: ['updated_at'],
  provider_limits: ['id'],
  provider_runs: ['updated_at'],
  resolve_attempts: ['updated_at'],
  resolve_batches: ['updated_at'],
  resolve_candidate_items: ['id', 'created_at', 'updated_at'],
  resolve_check_runs: ['updated_at'],
  resolve_imports: ['id', 'created_at', 'updated_at'],
  resolve_publication_threads: ['id', 'created_at', 'updated_at'],
  resolve_publications: ['updated_at'],
  resolve_session_settings: ['id', 'created_at'],
  schema_migration_segment: ['id', 'created_at', 'updated_at'],
  schema_version: ['id', 'created_at', 'updated_at'],
  security_findings: ['created_at', 'updated_at'],
  session_budgets: ['id', 'created_at', 'updated_at'],
  session_events: ['updated_at'],
  session_external_tasks: ['id', 'updated_at'],
  session_workflows: ['id', 'updated_at'],
  settings: ['id', 'created_at'],
  steps: ['created_at', 'updated_at'],
  telemetry_records: ['created_at', 'updated_at'],
  turn_events: ['updated_at'],
  workspace_profiles: ['id', 'created_at'],
  workspace_starred_issues: ['id', 'created_at', 'updated_at'],
  workspace_values: ['id', 'created_at'],
  worktree_roots: ['id', 'created_at', 'updated_at'],
};

const SEARCH_TABLE = /^search_index(_|$)/;

type TableRow = {
  readonly name: string;
};

type ColumnRow = {
  readonly name: string;
  readonly pk: number;
  readonly type: string;
};

type ForeignKeyRow = {
  readonly from: string;
  readonly table: string;
  readonly on_delete: string;
};

type DatabaseParams = {
  readonly db: Database;
};

const userTables = async ({ db }: DatabaseParams): Promise<ReadonlyArray<string>> =>
  (
    await db.select<TableRow>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
  )
    .map((row) => row.name)
    .filter((name) => !SEARCH_TABLE.test(name));

type MissingParams = DatabaseParams & {
  readonly table: string;
};

const missingBaseColumns = async ({
  db,
  table,
}: MissingParams): Promise<ReadonlyArray<RuleColumn>> => {
  const info = await db.select<ColumnRow>(`PRAGMA table_info(${table})`);
  const names = new Set(info.map((column) => column.name));
  const hasTextId = info.some(
    (column) => column.name === 'id' && column.pk === 1 && column.type === 'TEXT',
  );
  return [
    ...(hasTextId ? [] : ['id' as const]),
    ...(names.has('created_at') ? [] : ['created_at' as const]),
    ...(names.has('updated_at') ? [] : ['updated_at' as const]),
  ];
};

describe('schema rules in packages/db/CONVENTIONS.md', () => {
  it('lets only the listed tables lack id, created_at or updated_at, and the list only falls', async () => {
    const db = await makeMigratedTestDatabase();
    const actual: Record<string, ReadonlyArray<RuleColumn>> = {};
    for (const table of await userTables({ db })) {
      const missing = await missingBaseColumns({ db, table });
      if (missing.length > 0) {
        actual[table] = missing;
      }
    }

    expect(
      actual,
      'A table lacks id, created_at or updated_at without being listed, or a listed table now has them. Give a new table the three columns; remove a fixed table from EXEMPT_FROM_BASE_COLUMNS. Never add to it.',
    ).toEqual(EXEMPT_FROM_BASE_COLUMNS);
  });

  it('gives every foreign key an explicit ON DELETE behavior', async () => {
    const db = await makeMigratedTestDatabase();
    const implicit: string[] = [];
    for (const table of await userTables({ db })) {
      const keys = await db.select<ForeignKeyRow>(`PRAGMA foreign_key_list(${table})`);
      for (const key of keys) {
        if (key.on_delete === 'NO ACTION') {
          implicit.push(`${table}.${key.from} -> ${key.table}`);
        }
      }
    }

    expect(implicit).toEqual([]);
  });

  it('reads the pointer columns of the auto tables as nullable links that outlive their target', async () => {
    const db = await makeMigratedTestDatabase();
    const trees = await db.select<ForeignKeyRow>('PRAGMA foreign_key_list(auto_trees)');
    const delegations = await db.select<ForeignKeyRow>('PRAGMA foreign_key_list(auto_delegations)');
    const setNull = [...trees, ...delegations]
      .filter((key) => key.on_delete === 'SET NULL')
      .map((key) => `${key.from} -> ${key.table}`)
      .sort();

    expect(setNull).toEqual([
      'primary_mount_id -> session_worktrees',
      'retry_of -> auto_delegations',
    ]);
  });
});
