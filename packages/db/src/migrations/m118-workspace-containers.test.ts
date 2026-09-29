import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { insertRow, migrateThrough, selectRows, type Row } from '../test-helpers/migration-rows';

const NOW = 1_775_000_000_000;
const HUB = 'composite-hub';
const LEDGER = 'project-ledger-core';
const NOTES = 'project-notes';

const project = (fields: Row): Row => ({
  default_provider_id: 'codex',
  default_workflow_id: 'workflow-review',
  default_branch_prefix: 'ak/',
  parallel_enabled: 1,
  default_verbosity: 'verbose',
  provider_bindings: '{"codex":"account-a"}',
  task_models: '{"plan":"model-a"}',
  role_models: '{"reviewer":"model-b"}',
  scout_fanout: 3,
  provider_pool: '["codex","gemini"]',
  created_at: NOW - 3000,
  updated_at: NOW - 2000,
  last_accessed_at: NOW - 1000,
  ...fields,
});

const seedThrough117 = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 117 });
  const projects: ReadonlyArray<Row> = [
    project({ id: HUB, name: 'Harborline Hub', root_path: '/fixture/hub', kind: 'composite' }),
    project({
      id: LEDGER,
      name: 'ledger-core',
      root_path: '/fixture/ledger-core',
      kind: 'repo',
      default_provider_id: 'gemini',
    }),
    project({
      id: NOTES,
      name: 'Notes Vault',
      root_path: '/fixture/notes',
      kind: 'simple',
      disconnected_at: NOW - 500,
      deleted_at: NOW - 400,
      scout_fanout: null,
      provider_pool: null,
    }),
  ];
  for (const row of projects) {
    await insertRow({ db, table: 'projects', row });
  }
  await insertRow({
    db,
    table: 'workspace_members',
    row: {
      id: 'member-1',
      composite_workspace_id: HUB,
      member_workspace_id: LEDGER,
      mount_name: 'ledger-core',
      sort_order: 0,
      created_at: NOW,
    },
  });
  const sessions: ReadonlyArray<Row> = [
    {
      id: 'session-ledger',
      workspace_id: LEDGER,
      goal: 'Reconcile',
      state_kind: 'running',
      state_payload: '{"lastActivityAt":1}',
      provider_default: 'codex',
      current_step_ordinal: 1,
      created_at: NOW - 900,
      updated_at: NOW - 800,
      effort: 'high',
      user_status: 'done',
      provider_enabled: 'codex,gemini',
    },
    {
      id: 'session-notes',
      workspace_id: NOTES,
      goal: 'Notes',
      state_kind: 'idle',
      created_at: NOW - 700,
      updated_at: NOW - 600,
      archived_at: NOW - 100,
    },
  ];
  for (const row of sessions) {
    await insertRow({ db, table: 'sessions', row });
  }
  await insertRow({
    db,
    table: 'session_worktrees',
    row: {
      id: 'worktree-1',
      session_id: 'session-ledger',
      worktree_path: '/worktrees/ledger',
      branch: 'ak/reconcile',
      parallel_index: 0,
      created_at: NOW - 650,
      repo_slug: 'harborline/ledger-core',
    },
  });
  const workflows: ReadonlyArray<Row> = [
    {
      id: 'workflow-review',
      workspace_id: LEDGER,
      name: 'Review',
      description: 'Review the change',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-04-02T10:00:00.000Z',
      is_preset: 0,
      goal: 'Ship it',
      process_text: 'Read then decide',
      origin: 'imported',
    },
    {
      id: 'workflow-notes',
      workspace_id: NOTES,
      name: 'Notes flow',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-04-02T10:00:00.000Z',
      deleted_at: NOW - 300,
    },
  ];
  for (const row of workflows) {
    await insertRow({ db, table: 'workflows', row });
  }
  await insertRow({
    db,
    table: 'steps',
    row: {
      id: 'step-1',
      workflow_id: 'workflow-review',
      ordinal: 0,
      name: 'Read',
      prompt_prefix: 'Read carefully',
      effort: 'low',
    },
  });
  await insertRow({
    db,
    table: 'session_workflows',
    row: {
      workflow_run_id: 'run-1',
      session_id: 'session-notes',
      workflow_id: 'workflow-notes',
      ordinal: 0,
      created_at: '2026-04-03T10:00:00.000Z',
      goal: 'Run goal',
    },
  });
  const library: ReadonlyArray<Row> = [
    {
      id: 'library-global',
      workspace_id: null,
      role: 'reviewer',
      name: 'Global reviewer',
      prompt_prefix: 'Review',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-04-01T10:00:00.000Z',
    },
    {
      id: 'library-notes',
      workspace_id: NOTES,
      base_step_id: 'library-global',
      role: 'custom',
      name: 'Notes step',
      prompt_prefix: 'Summarize',
      provider_default: 'codex',
      model_default: 'model-a',
      effort_default: 'medium',
      verbosity_default: 'brief',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-04-02T10:00:00.000Z',
    },
  ];
  for (const row of library) {
    await insertRow({ db, table: 'step_library', row });
  }
  await insertRow({
    db,
    table: 'skills',
    row: {
      id: 'skill-1',
      workspace_id: NOTES,
      name: 'deploy',
      description: 'Deploy notes',
      file_path: '/skills/deploy/SKILL.md',
      body: '# Deploy',
      frontmatter_json: '{"tags":["ops"]}',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-04-02T10:00:00.000Z',
    },
  });
  const notifications: ReadonlyArray<Row> = [
    {
      id: 'notification-notes',
      ts: '2026-04-05T10:00:00.000Z',
      kind: 'completed',
      title: 'Done',
      body: 'All green',
      severity: 'warning',
      session_id: 'session-notes',
      workspace_id: NOTES,
      read: 1,
      action: '{"kind":"open"}',
    },
    {
      id: 'notification-global',
      ts: '2026-04-06T10:00:00.000Z',
      kind: 'update',
      title: 'Update',
    },
  ];
  for (const row of notifications) {
    await insertRow({ db, table: 'notifications', row });
  }
  const rules: ReadonlyArray<Row> = [
    {
      id: 'rule-session',
      scope: 'session',
      session_id: 'session-ledger',
      pattern_tool: 'Bash',
      pattern_args_matcher: 'git *',
      decision: 'deny',
      priority: 5,
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-04-02T10:00:00.000Z',
    },
    {
      id: 'rule-notes',
      scope: 'workspace',
      workspace_id: NOTES,
      pattern_tool: 'Read',
      decision: 'allow',
      priority: 2,
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-04-02T10:00:00.000Z',
    },
  ];
  for (const row of rules) {
    await insertRow({ db, table: 'permission_rules', row });
  }
  await insertRow({
    db,
    table: 'workspace_scripts',
    row: {
      id: 'script-1',
      workspace_id: LEDGER,
      name: 'Test',
      body: 'pnpm test',
      sort_order: 4,
      created_at: NOW,
      updated_at: NOW + 1,
    },
  });
  await insertRow({
    db,
    table: 'settings',
    row: { key: `workspace.${NOTES}.branch_prefix`, value: 'notes/', updated_at: NOW },
  });
  return db;
};

type Snapshot = {
  readonly table: string;
  readonly orderBy: string;
};

type Migrated = {
  readonly db: Database;
  readonly before: Readonly<Record<string, ReadonlyArray<Row>>>;
  readonly notesWorkspace: string;
  readonly workspaceOf: Readonly<Record<string, string>>;
};

const migrated = async (snapshots: ReadonlyArray<Snapshot> = []): Promise<Migrated> => {
  const db = await seedThrough117();
  const before: Record<string, ReadonlyArray<Row>> = {};
  for (const { table, orderBy } of snapshots) {
    before[table] = await selectRows({ db, table, orderBy });
  }
  await migrateThrough({ db, version: 118 });
  const rows = await db.select<{ readonly id: string; readonly workspace_id: string }>(
    'SELECT id, workspace_id FROM projects',
  );
  const notesWorkspace = rows.find((row) => row.id === NOTES)?.workspace_id ?? '';
  return { db, before, notesWorkspace, workspaceOf: { [LEDGER]: HUB, [NOTES]: notesWorkspace } };
};

type RemapParams = {
  readonly row: Row;
  readonly workspaceOf: Readonly<Record<string, string>>;
};

const remap = ({ row, workspaceOf }: RemapParams): Row => {
  const value = row['workspace_id'];
  return typeof value === 'string' && value in workspaceOf
    ? { ...row, workspace_id: workspaceOf[value] }
    : row;
};

const remapped = ({
  rows,
  workspaceOf,
}: {
  readonly rows: ReadonlyArray<Row> | undefined;
  readonly workspaceOf: Readonly<Record<string, string>>;
}) => (rows ?? []).map((row) => remap({ row, workspaceOf }));

describe('m118 workspace containers', () => {
  it('copies the full configuration of each container and standalone project into a workspace', async () => {
    const { db, notesWorkspace } = await migrated();
    const workspaces = await selectRows({ db, table: 'workspaces', orderBy: 'name' });

    expect(workspaces.map((row) => row['id']).sort()).toEqual([HUB, notesWorkspace].sort());
    expect(workspaces.find((row) => row['id'] === HUB)).toEqual({
      id: HUB,
      slug: 'harborline-hub',
      sessions_root: null,
      name: 'Harborline Hub',
      default_provider_id: 'codex',
      default_workflow_id: 'workflow-review',
      default_branch_prefix: 'ak/',
      parallel_enabled: 1,
      default_verbosity: 'verbose',
      provider_bindings: '{"codex":"account-a"}',
      task_models: '{"plan":"model-a"}',
      role_models: '{"reviewer":"model-b"}',
      scout_fanout: 3,
      provider_pool: '["codex","gemini"]',
      created_at: NOW - 3000,
      updated_at: NOW - 2000,
      deleted_at: null,
      disconnected_at: null,
      last_accessed_at: NOW - 1000,
    });
    expect(workspaces.find((row) => row['id'] === notesWorkspace)).toEqual({
      id: notesWorkspace,
      slug: 'notes-vault',
      sessions_root: null,
      name: 'Notes Vault',
      default_provider_id: 'codex',
      default_workflow_id: 'workflow-review',
      default_branch_prefix: 'ak/',
      parallel_enabled: 1,
      default_verbosity: 'verbose',
      provider_bindings: '{"codex":"account-a"}',
      task_models: '{"plan":"model-a"}',
      role_models: '{"reviewer":"model-b"}',
      scout_fanout: null,
      provider_pool: null,
      created_at: NOW - 3000,
      updated_at: NOW - 2000,
      deleted_at: NOW - 400,
      disconnected_at: NOW - 500,
      last_accessed_at: NOW - 1000,
    });
  });

  it('moves the projects under their workspace without touching their own columns', async () => {
    const { db, before, workspaceOf } = await migrated([{ table: 'projects', orderBy: 'id' }]);
    const after = await selectRows({ db, table: 'projects', orderBy: 'id' });

    const survivors = (before['projects'] ?? []).filter((row) => row['kind'] !== 'composite');
    expect(survivors).toHaveLength(2);
    expect(after).toEqual(
      survivors.map((row) => ({ ...row, workspace_id: workspaceOf[String(row['id'])] })),
    );
  });

  it('keeps every workflow column and its steps and runs while remapping the workspace', async () => {
    const { db, before, workspaceOf } = await migrated([
      { table: 'workflows', orderBy: 'id' },
      { table: 'steps', orderBy: 'id' },
      { table: 'session_workflows', orderBy: 'workflow_run_id' },
    ]);

    expect(await selectRows({ db, table: 'workflows', orderBy: 'id' })).toEqual(
      remapped({ rows: before['workflows'], workspaceOf }),
    );
    expect(await selectRows({ db, table: 'steps', orderBy: 'id' })).toEqual(before['steps']);
    expect(
      await selectRows({ db, table: 'session_workflows', orderBy: 'workflow_run_id' }),
    ).toEqual(before['session_workflows']);
    expect(before['steps']).toHaveLength(1);
    expect(before['session_workflows']).toHaveLength(1);
  });

  it('keeps every column of library steps, skills and notifications, and their null owners', async () => {
    const tables = [
      { table: 'step_library', orderBy: 'id' },
      { table: 'skills', orderBy: 'id' },
      { table: 'notifications', orderBy: 'id' },
    ];
    const { db, before, workspaceOf } = await migrated(tables);

    for (const { table, orderBy } of tables) {
      expect(await selectRows({ db, table, orderBy })).toEqual(
        remapped({ rows: before[table], workspaceOf }),
      );
    }
    const owners = await db.select<{ readonly workspace_id: string | null }>(
      `SELECT workspace_id FROM step_library WHERE id = 'library-global'
       UNION ALL SELECT workspace_id FROM notifications WHERE id = 'notification-global'`,
    );
    expect(owners).toEqual([{ workspace_id: null }, { workspace_id: null }]);
  });

  it('keeps every permission rule column, including session scoped rules', async () => {
    const { db, before, workspaceOf } = await migrated([
      { table: 'permission_rules', orderBy: 'id' },
    ]);
    const after = await selectRows({ db, table: 'permission_rules', orderBy: 'id' });

    expect(after).toEqual(
      remapped({ rows: before['permission_rules'], workspaceOf }).map((row) => ({
        ...row,
        project_id: null,
      })),
    );
    expect(after.find((row) => row['id'] === 'rule-session')).toMatchObject({
      scope: 'session',
      session_id: 'session-ledger',
      priority: 5,
      pattern_args_matcher: 'git *',
      decision: 'deny',
    });
  });

  it('remaps sessions and fills the worktree mount without touching other columns', async () => {
    const { db, before, workspaceOf } = await migrated([{ table: 'sessions', orderBy: 'id' }]);

    expect(await selectRows({ db, table: 'sessions', orderBy: 'id' })).toEqual(
      remapped({ rows: before['sessions'], workspaceOf }),
    );
    expect(await selectRows({ db, table: 'session_worktrees', orderBy: 'id' })).toEqual([
      {
        id: 'worktree-1',
        session_id: 'session-ledger',
        worktree_path: '/worktrees/ledger',
        branch: 'ak/reconcile',
        parallel_index: 0,
        created_at: NOW - 650,
        mount_workspace_id: LEDGER,
        mount_name: null,
        repo_slug: 'harborline/ledger-core',
      },
    ]);
  });

  it('renames the project scripts table with its rows and rekeys the branch prefix setting', async () => {
    const { db, notesWorkspace } = await migrated();

    expect(await selectRows({ db, table: 'project_scripts', orderBy: 'id' })).toEqual([
      {
        id: 'script-1',
        project_id: LEDGER,
        name: 'Test',
        body: 'pnpm test',
        sort_order: 4,
        created_at: NOW,
        updated_at: NOW + 1,
      },
    ]);
    expect(await selectRows({ db, table: 'settings', orderBy: 'key' })).toEqual([
      { key: `workspace.${notesWorkspace}.branch_prefix`, value: 'notes/', updated_at: NOW },
    ]);
  });
});
