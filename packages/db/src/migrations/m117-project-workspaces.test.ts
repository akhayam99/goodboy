import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = 1_775_000_000_000;
const projectMigrations = migrations.filter((migration) => migration.version <= 121);

type InsertWorkspaceParams = {
  readonly db: Database;
  readonly id: string;
  readonly name: string;
  readonly kind: 'repo' | 'simple' | 'composite';
  readonly lastAccessedAt: number;
  readonly disconnectedAt?: number;
  readonly deletedAt?: number;
  readonly branchPrefix?: string;
};

const insertWorkspace = async ({
  db,
  id,
  name,
  kind,
  lastAccessedAt,
  disconnectedAt,
  deletedAt,
  branchPrefix,
}: InsertWorkspaceParams): Promise<void> => {
  await db.execute(
    `INSERT INTO workspaces (
      id,
      name,
      root_path,
      default_branch_prefix,
      created_at,
      updated_at,
      deleted_at,
      disconnected_at,
      last_accessed_at,
      kind
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      `/fixture/${id}`,
      branchPrefix ?? null,
      NOW - 1000,
      NOW,
      deletedAt ?? null,
      disconnectedAt ?? null,
      lastAccessedAt,
      kind,
    ],
  );
};

type InsertMemberParams = {
  readonly db: Database;
  readonly id: string;
  readonly compositeId: string;
  readonly memberId: string;
  readonly sortOrder: number;
};

const insertMember = async ({
  db,
  id,
  compositeId,
  memberId,
  sortOrder,
}: InsertMemberParams): Promise<void> => {
  await db.execute(
    `INSERT INTO workspace_members (
      id,
      composite_workspace_id,
      member_workspace_id,
      mount_name,
      sort_order,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, compositeId, memberId, memberId, sortOrder, NOW],
  );
};

type InsertSessionParams = {
  readonly db: Database;
  readonly id: string;
  readonly workspaceId: string;
  readonly activeProjectId?: string;
};

const insertSession = async ({
  db,
  id,
  workspaceId,
  activeProjectId,
}: InsertSessionParams): Promise<void> => {
  await db.execute(
    `INSERT INTO sessions (
      id,
      workspace_id,
      goal,
      state_kind,
      created_at,
      updated_at,
      active_mount_workspace_id
    ) VALUES (?, ?, ?, 'idle', ?, ?, ?)`,
    [id, workspaceId, id, NOW, NOW, activeProjectId ?? null],
  );
};

type InsertWorktreeParams = {
  readonly db: Database;
  readonly id: string;
  readonly sessionId: string;
  readonly parallelIndex: number;
  readonly projectId?: string;
};

const insertWorktree = async ({
  db,
  id,
  sessionId,
  parallelIndex,
  projectId,
}: InsertWorktreeParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_worktrees (
      id,
      session_id,
      worktree_path,
      branch,
      parallel_index,
      created_at,
      mount_workspace_id
    ) VALUES (?, ?, ?, 'main', ?, ?, ?)`,
    [id, sessionId, `/worktrees/${id}`, parallelIndex, NOW, projectId ?? null],
  );
};

const seedThrough116 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 116),
  );

  await insertWorkspace({
    db,
    id: 'composite-primary',
    name: 'Demo Platform',
    kind: 'composite',
    lastAccessedAt: 900,
    branchPrefix: 'platform/',
  });
  await insertWorkspace({
    db,
    id: 'composite-secondary',
    name: 'Secondary',
    kind: 'composite',
    lastAccessedAt: 100,
  });
  await insertWorkspace({
    db,
    id: 'composite-disconnected',
    name: 'Disconnected',
    kind: 'composite',
    lastAccessedAt: 800,
    disconnectedAt: NOW - 500,
  });
  await insertWorkspace({
    db,
    id: 'project-api',
    name: 'API',
    kind: 'repo',
    lastAccessedAt: 700,
  });
  await insertWorkspace({
    db,
    id: 'project-repo',
    name: 'Harmonies',
    kind: 'repo',
    lastAccessedAt: 600,
    disconnectedAt: NOW - 400,
    deletedAt: NOW - 300,
  });
  await insertWorkspace({
    db,
    id: 'project-folder',
    name: 'Harmonies',
    kind: 'simple',
    lastAccessedAt: 500,
  });

  await insertMember({
    db,
    id: 'member-primary-api',
    compositeId: 'composite-primary',
    memberId: 'project-api',
    sortOrder: 0,
  });
  await insertMember({
    db,
    id: 'member-secondary-api',
    compositeId: 'composite-secondary',
    memberId: 'project-api',
    sortOrder: 0,
  });
  await insertMember({
    db,
    id: 'member-disconnected-repo',
    compositeId: 'composite-disconnected',
    memberId: 'project-repo',
    sortOrder: 0,
  });
  await insertMember({
    db,
    id: 'member-disconnected-folder',
    compositeId: 'composite-disconnected',
    memberId: 'project-folder',
    sortOrder: 1,
  });

  await insertSession({ db, id: 'session-composite', workspaceId: 'composite-primary' });
  await insertSession({
    db,
    id: 'session-dual',
    workspaceId: 'project-api',
    activeProjectId: 'project-api',
  });
  await insertSession({
    db,
    id: 'session-disconnected',
    workspaceId: 'composite-disconnected',
  });
  await insertSession({ db, id: 'session-standalone', workspaceId: 'project-repo' });
  await db.execute(
    'INSERT INTO session_events (id, session_id, kind, created_at) VALUES (?, ?, ?, ?)',
    ['event-dual', 'session-dual', 'branch_created', NOW],
  );

  await insertWorktree({
    db,
    id: 'worktree-composite-container',
    sessionId: 'session-composite',
    parallelIndex: 0,
  });
  await insertWorktree({
    db,
    id: 'worktree-composite-project',
    sessionId: 'session-composite',
    parallelIndex: 1,
    projectId: 'project-api',
  });
  await insertWorktree({
    db,
    id: 'worktree-dual-zero',
    sessionId: 'session-dual',
    parallelIndex: 0,
  });
  await insertWorktree({
    db,
    id: 'worktree-disconnected-container',
    sessionId: 'session-disconnected',
    parallelIndex: 0,
  });
  await insertWorktree({
    db,
    id: 'worktree-standalone-zero',
    sessionId: 'session-standalone',
    parallelIndex: 0,
  });
  await insertWorktree({
    db,
    id: 'worktree-standalone-parallel',
    sessionId: 'session-standalone',
    parallelIndex: 1,
  });

  await db.execute(
    `INSERT INTO session_external_tasks (
      session_id,
      mount_workspace_id,
      provider,
      external_id,
      identifier,
      url,
      title,
      created_at
    ) VALUES (?, ?, 'github', '123', 'GB-123', 'https://example.test/123', 'Task', ?)`,
    ['session-composite', 'project-api', NOW],
  );

  await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
    'workspace.composite-primary.branch_prefix',
    'container/',
    NOW - 100,
  ]);
  await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
    'workspace.project-api.branch_prefix',
    'project/',
    NOW,
  ]);
  await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
    'workspace.project-repo.branch_prefix',
    'repo/',
    NOW,
  ]);
  await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
    'workspace.project-api.agent_title_mode',
    'goal',
    NOW,
  ]);

  await db.execute(
    `INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at)
     VALUES
       ('workflow-active-composite', 'composite-primary', 'Active composite', '', ?, ?),
       ('workflow-surviving-project', 'project-api', 'Surviving project', '', ?, ?),
       ('workflow-disconnected-composite', 'composite-disconnected', 'Disconnected composite', '', ?, ?)`,
    [NOW - 1000, NOW - 900, NOW - 800, NOW - 700, NOW - 600, NOW - 500],
  );
  await db.execute(
    `INSERT INTO step_library (id, workspace_id, name, created_at, updated_at)
     VALUES ('library-project-folder', 'project-folder', 'Folder step', ?, ?)`,
    [NOW - 1000, NOW],
  );
  await db.execute(
    `INSERT INTO notifications (id, ts, kind, title, workspace_id)
     VALUES ('notification-disconnected', ?, 'completed', 'Disconnected', 'composite-disconnected')`,
    [String(NOW)],
  );
  await db.execute(
    `INSERT INTO skills (
      id,
      workspace_id,
      name,
      description,
      file_path,
      body,
      frontmatter_json,
      created_at,
      updated_at
    ) VALUES
      ('skill-composite-older', 'composite-primary', 'deploy', '', '/old', 'old', '{}', ?, ?),
      ('skill-project-newer', 'project-api', 'deploy', '', '/new', 'new', '{}', ?, ?)`,
    [
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    ],
  );
  await db.execute(
    `INSERT INTO permission_rules (
      id,
      scope,
      workspace_id,
      pattern_tool,
      decision,
      created_at,
      updated_at
    ) VALUES
      ('rule-active-composite', 'workspace', 'composite-primary', 'Read', 'allow', ?, ?),
      ('rule-absorbed-project', 'workspace', 'project-api', 'Read', 'allow', ?, ?),
      ('rule-standalone-project', 'workspace', 'project-repo', 'Read', 'allow', ?, ?)`,
    [NOW, NOW, NOW, NOW, NOW, NOW],
  );
  await db.execute(
    `INSERT INTO workspace_scripts (
      id,
      workspace_id,
      name,
      body,
      sort_order,
      created_at,
      updated_at
    ) VALUES ('script-project-api', 'project-api', 'Run', 'pnpm test', 0, ?, ?)`,
    [NOW, NOW],
  );

  return db;
};

const migrateFixture = async (): Promise<Database> => {
  const db = await seedThrough116();
  await migrate(db, projectMigrations);
  return db;
};

describe('project workspace migration', () => {
  it('absorbs active composites and chooses the most recently accessed claimant', async () => {
    const db = await migrateFixture();
    const workspaces = await db.select<{
      readonly id: string;
      readonly sessions_root: string;
      readonly default_branch_prefix: string | null;
    }>(
      "SELECT id, sessions_root, default_branch_prefix FROM workspaces WHERE id LIKE 'composite-%' ORDER BY id",
    );
    const projects = await db.select<{ readonly id: string; readonly workspace_id: string }>(
      "SELECT id, workspace_id FROM projects WHERE id = 'project-api'",
    );
    const compositeProjects = await db.select<{ readonly total: number }>(
      "SELECT COUNT(*) AS total FROM projects WHERE kind = 'composite'",
    );
    const indexes = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'projects' AND sql IS NOT NULL ORDER BY name",
    );

    expect(workspaces).toEqual([
      {
        id: 'composite-primary',
        sessions_root: '/fixture/composite-primary',
        default_branch_prefix: 'platform/',
      },
      {
        id: 'composite-secondary',
        sessions_root: '/fixture/composite-secondary',
        default_branch_prefix: null,
      },
    ]);
    expect(projects[0]?.workspace_id).toBe('composite-primary');
    expect(compositeProjects[0]?.total).toBe(0);
    expect(indexes.map((index) => index.name)).toEqual([
      'idx_projects_active',
      'idx_projects_last_accessed_at',
      'idx_projects_workspace_id',
    ]);
    await expect(db.select('SELECT * FROM workspace_members')).rejects.toThrow(/no such table/);
  });

  it('reassigns disconnected-composite sessions to the first member workspace', async () => {
    const db = await migrateFixture();
    const rows = await db.select<{
      readonly session_workspace_id: string;
      readonly project_workspace_id: string;
    }>(
      `SELECT
        sessions.workspace_id AS session_workspace_id,
        projects.workspace_id AS project_workspace_id
      FROM sessions
      JOIN projects ON projects.id = 'project-repo'
      WHERE sessions.id = 'session-disconnected'`,
    );
    const disconnected = await db.select<{ readonly total: number }>(
      "SELECT COUNT(*) AS total FROM workspaces WHERE id = 'composite-disconnected'",
    );

    expect(rows[0]?.session_workspace_id).toBe(rows[0]?.project_workspace_id);
    expect(disconnected[0]?.total).toBe(0);
  });

  it('remaps workflows for active composites, surviving projects, and disconnected composites', async () => {
    const db = await migrateFixture();
    const firstMember = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM projects WHERE id = 'project-repo'",
    );
    const workflows = await db.select<{ readonly id: string; readonly workspace_id: string }>(
      "SELECT id, workspace_id FROM workflows WHERE id LIKE 'workflow-%' ORDER BY id",
    );
    const violations = await db.select<{ readonly table: string }>(
      "PRAGMA foreign_key_check('workflows')",
    );

    expect(workflows).toEqual([
      { id: 'workflow-active-composite', workspace_id: 'composite-primary' },
      {
        id: 'workflow-disconnected-composite',
        workspace_id: firstMember[0]?.workspace_id,
      },
      { id: 'workflow-surviving-project', workspace_id: 'composite-primary' },
    ]);
    expect(violations).toEqual([]);
  });

  it('renames live workflow collisions without touching soft-deleted rows', async () => {
    const db = await seedThrough116();
    await db.execute(
      `INSERT INTO workflows (
        id,
        workspace_id,
        name,
        description,
        created_at,
        updated_at,
        deleted_at
      ) VALUES
        ('workflow-bug-fix-older', 'composite-primary', 'Bug fix', 'older content', ?, ?, NULL),
        ('workflow-bug-fix-newer', 'project-api', 'Bug fix', 'newer content', ?, ?, NULL),
        ('workflow-bug-fix-deleted', 'composite-primary', 'Bug fix', 'deleted content', ?, ?, ?)`,
      [
        NOW - 5000,
        '2026-01-01T00:00:00.000Z',
        NOW - 4000,
        '2026-01-02T00:00:00.000Z',
        NOW - 3000,
        '2026-01-03T00:00:00.000Z',
        NOW - 2000,
      ],
    );

    await migrate(db, projectMigrations);
    const live = await db.select<{
      readonly id: string;
      readonly name: string;
      readonly description: string;
    }>(
      `SELECT id, name, description
       FROM workflows
       WHERE id IN ('workflow-bug-fix-older', 'workflow-bug-fix-newer')
       ORDER BY id`,
    );
    const deleted = await db.select<{
      readonly name: string;
      readonly description: string;
      readonly deleted_at: number | null;
    }>("SELECT name, description, deleted_at FROM workflows WHERE id = 'workflow-bug-fix-deleted'");

    expect(live).toEqual([
      {
        id: 'workflow-bug-fix-newer',
        name: 'Bug fix',
        description: 'newer content',
      },
      {
        id: 'workflow-bug-fix-older',
        name: 'Bug fix 2',
        description: 'older content',
      },
    ]);
    expect(deleted).toEqual([
      {
        name: 'Bug fix',
        description: 'deleted content',
        deleted_at: NOW - 2000,
      },
    ]);
  });

  it('remaps the other container-scoped tables', async () => {
    const db = await migrateFixture();
    const folder = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM projects WHERE id = 'project-folder'",
    );
    const repo = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM projects WHERE id = 'project-repo'",
    );
    const library = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM step_library WHERE id = 'library-project-folder'",
    );
    const notification = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM notifications WHERE id = 'notification-disconnected'",
    );

    expect(library[0]?.workspace_id).toBe(folder[0]?.workspace_id);
    expect(notification[0]?.workspace_id).toBe(repo[0]?.workspace_id);
  });

  it('keeps the newest skill after a container merge and enforces name uniqueness', async () => {
    const db = await migrateFixture();
    const skills = await db.select<{
      readonly id: string;
      readonly workspace_id: string;
      readonly body: string;
    }>("SELECT id, workspace_id, body FROM skills WHERE name = 'deploy'");

    expect(skills).toEqual([
      { id: 'skill-project-newer', workspace_id: 'composite-primary', body: 'new' },
    ]);
    await expect(
      db.execute(
        `INSERT INTO skills (
          id,
          workspace_id,
          name,
          description,
          file_path,
          body,
          frontmatter_json
        ) VALUES ('skill-duplicate', 'composite-primary', 'deploy', '', '/duplicate', '', '{}')`,
      ),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('adds the project permission rung and preserves standalone workspace semantics', async () => {
    const db = await migrateFixture();
    const standalone = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM projects WHERE id = 'project-repo'",
    );
    const rules = await db.select<{
      readonly id: string;
      readonly scope: string;
      readonly workspace_id: string;
      readonly project_id: string | null;
    }>(
      "SELECT id, scope, workspace_id, project_id FROM permission_rules WHERE id LIKE 'rule-%' ORDER BY id",
    );
    const keys = await db.select<{ readonly table: string; readonly from: string }>(
      'PRAGMA foreign_key_list(permission_rules)',
    );

    expect(rules).toEqual([
      {
        id: 'rule-absorbed-project',
        scope: 'project',
        workspace_id: 'composite-primary',
        project_id: 'project-api',
      },
      {
        id: 'rule-active-composite',
        scope: 'workspace',
        workspace_id: 'composite-primary',
        project_id: null,
      },
      {
        id: 'rule-standalone-project',
        scope: 'workspace',
        workspace_id: standalone[0]?.workspace_id,
        project_id: null,
      },
    ]);
    expect(keys.map((key) => ({ table: key.table, from: key.from }))).toContainEqual({
      table: 'projects',
      from: 'project_id',
    });
  });

  it('renames workspace scripts and keeps them project-scoped', async () => {
    const db = await migrateFixture();
    const scripts = await db.select<{ readonly id: string; readonly project_id: string }>(
      'SELECT id, project_id FROM project_scripts',
    );
    const keys = await db.select<{ readonly table: string; readonly from: string }>(
      'PRAGMA foreign_key_list(project_scripts)',
    );
    const indexes = await db.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'project_scripts' AND sql IS NOT NULL",
    );

    expect(scripts).toEqual([{ id: 'script-project-api', project_id: 'project-api' }]);
    expect(keys.map((key) => ({ table: key.table, from: key.from }))).toContainEqual({
      table: 'projects',
      from: 'project_id',
    });
    expect(indexes.map((index) => index.name)).toEqual(['idx_project_scripts_project']);
    await expect(db.select('SELECT * FROM workspace_scripts')).rejects.toThrow(/no such table/);
  });

  it('moves standalone sessions of an active-composite member into the container', async () => {
    const db = await migrateFixture();
    const sessions = await db.select<{
      readonly id: string;
      readonly workspace_id: string;
      readonly active_project_id: string | null;
    }>(
      "SELECT id, workspace_id, active_project_id FROM sessions WHERE id IN ('session-composite', 'session-dual') ORDER BY id",
    );
    const keys = await db.select<{ readonly table: string; readonly from: string }>(
      'PRAGMA foreign_key_list(sessions)',
    );

    expect(sessions).toEqual([
      {
        id: 'session-composite',
        workspace_id: 'composite-primary',
        active_project_id: null,
      },
      {
        id: 'session-dual',
        workspace_id: 'composite-primary',
        active_project_id: 'project-api',
      },
    ]);
    expect(keys.map((key) => ({ table: key.table, from: key.from }))).toContainEqual({
      table: 'workspaces',
      from: 'workspace_id',
    });
  });

  it('creates one-to-one fallbacks and converts simple projects to folders', async () => {
    const db = await migrateFixture();
    const rows = await db.select<{
      readonly id: string;
      readonly kind: string;
      readonly workspace_id: string;
      readonly disconnected_at: number | null;
      readonly deleted_at: number | null;
      readonly last_accessed_at: number | null;
    }>(
      `SELECT
        projects.id,
        projects.kind,
        projects.workspace_id,
        workspaces.disconnected_at,
        workspaces.deleted_at,
        workspaces.last_accessed_at
      FROM projects
      JOIN workspaces ON workspaces.id = projects.workspace_id
      WHERE projects.id IN ('project-folder', 'project-repo')
      ORDER BY projects.id`,
    );

    expect(rows[0]?.kind).toBe('folder');
    expect(rows[0]?.workspace_id).not.toBe(rows[0]?.id);
    expect(rows[1]).toMatchObject({
      kind: 'repo',
      disconnected_at: NOW - 400,
      deleted_at: NOW - 300,
      last_accessed_at: 600,
    });
    expect(rows[1]?.workspace_id).not.toBe(rows[1]?.id);
  });

  it('deduplicates slugs with numeric suffixes', async () => {
    const db = await migrateFixture();
    const slugs = await db.select<{ readonly slug: string }>(
      "SELECT slug FROM workspaces WHERE name = 'Harmonies' ORDER BY slug",
    );

    expect(slugs.map((row) => row.slug)).toEqual(['harmonies', 'harmonies-2']);
  });

  it('rekeys branch-prefix settings and removes agent-title settings', async () => {
    const db = await migrateFixture();
    const repo = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM projects WHERE id = 'project-repo'",
    );
    const settings = await db.select<{ readonly key: string; readonly value: string }>(
      'SELECT key, value FROM settings ORDER BY key',
    );

    expect(settings).toEqual(
      expect.arrayContaining([
        { key: 'workspace.composite-primary.branch_prefix', value: 'container/' },
        { key: `workspace.${repo[0]?.workspace_id}.branch_prefix`, value: 'repo/' },
      ]),
    );
    expect(settings).toHaveLength(2);
  });

  it('attributes ex-standalone index-zero worktrees to their project', async () => {
    const db = await migrateFixture();
    const standalone = await db.select<{
      readonly parallel_index: number;
      readonly project_id: string | null;
    }>(
      "SELECT parallel_index, project_id FROM session_worktrees WHERE session_id = 'session-standalone' ORDER BY parallel_index",
    );
    const composite = await db.select<{
      readonly parallel_index: number;
      readonly project_id: string | null;
    }>(
      "SELECT parallel_index, project_id FROM session_worktrees WHERE session_id = 'session-composite' ORDER BY parallel_index",
    );
    const dual = await db.select<{ readonly project_id: string | null }>(
      "SELECT project_id FROM session_worktrees WHERE id = 'worktree-dual-zero'",
    );

    expect(standalone).toEqual([
      { parallel_index: 0, project_id: 'project-repo' },
      { parallel_index: 1, project_id: 'project-repo' },
    ]);
    expect(composite).toEqual([
      { parallel_index: 0, project_id: null },
      { parallel_index: 1, project_id: 'project-api' },
    ]);
    expect(dual[0]?.project_id).toBe('project-api');
  });

  it('renames mount columns and enforces the project worktree foreign key', async () => {
    const db = await migrateFixture();
    const worktreeColumns = await db.select<{ readonly name: string }>(
      'PRAGMA table_info(session_worktrees)',
    );
    const externalColumns = await db.select<{ readonly name: string }>(
      'PRAGMA table_info(session_external_tasks)',
    );
    const worktreeKeys = await db.select<{ readonly table: string; readonly from: string }>(
      'PRAGMA foreign_key_list(session_worktrees)',
    );
    const external = await db.select<{ readonly project_id: string | null }>(
      "SELECT project_id FROM session_external_tasks WHERE session_id = 'session-composite'",
    );

    expect(worktreeColumns.map((column) => column.name)).toContain('project_id');
    expect(worktreeColumns.map((column) => column.name)).not.toContain('mount_workspace_id');
    expect(externalColumns.map((column) => column.name)).toContain('project_id');
    expect(worktreeKeys.map((key) => ({ table: key.table, from: key.from }))).toContainEqual({
      table: 'projects',
      from: 'project_id',
    });
    expect(external[0]?.project_id).toBe('project-api');
  });

  it('finishes with valid foreign keys and a container profile table', async () => {
    const db = await migrateFixture();
    await db.execute(
      `INSERT INTO workspace_profiles (
        workspace_id,
        role,
        discipline,
        topics,
        notes,
        updated_at
      ) VALUES ('composite-primary', 'engineering', 'software', '[]', 'notes', ?)`,
      [NOW],
    );
    const profiles = await db.select<{ readonly workspace_id: string }>(
      'SELECT workspace_id FROM workspace_profiles',
    );
    const violations = await db.select<{ readonly table: string }>('PRAGMA foreign_key_check');
    const events = await db.select<{ readonly total: number }>(
      "SELECT COUNT(*) AS total FROM session_events WHERE id = 'event-dual'",
    );

    expect(profiles).toEqual([{ workspace_id: 'composite-primary' }]);
    expect(events[0]?.total).toBe(1);
    expect(violations).toEqual([]);
  });
});
