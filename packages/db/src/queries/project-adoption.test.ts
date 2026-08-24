import { describe, expect, it } from 'vitest';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import { describeProjectAdoption, moveProjectToWorkspace } from './project-adoption';

const target = 'ws-target' as WorkspaceId;
const source = 'ws-source' as WorkspaceId;
const NOW = 1755900000000;

const seed = async () => {
  const db = makeTestDatabase();
  await migrate(db);
  for (const [index, id] of [target, source].entries()) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, id, id, NOW + index, NOW + index],
    );
  }
  return db;
};

type Db = Awaited<ReturnType<typeof seed>>;

const addProject = async ({
  db,
  id,
  workspaceId,
  disconnected = false,
}: {
  readonly db: Db;
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly disconnected?: boolean;
}) => {
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at, disconnected_at)
     VALUES (?, ?, ?, ?, 'repo', ?, ?, ?)`,
    [id, workspaceId, id, `/tmp/${id}`, NOW, NOW, disconnected ? NOW : null],
  );
};

const addSession = async ({
  db,
  id,
  workspaceId,
  activeProjectId = null,
  archived = false,
  deleted = false,
}: {
  readonly db: Db;
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly activeProjectId?: string | null;
  readonly archived?: boolean;
  readonly deleted?: boolean;
}) => {
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, active_project_id, archived_at, deleted_at, created_at, updated_at)
     VALUES (?, ?, 'goal', 'idle', ?, ?, ?, ?, ?)`,
    [id, workspaceId, activeProjectId, archived ? NOW : null, deleted ? NOW : null, NOW, NOW],
  );
};

const addMount = async ({
  db,
  sessionId,
  projectId,
  index = 0,
}: {
  readonly db: Db;
  readonly sessionId: string;
  readonly projectId: string;
  readonly index?: number;
}) => {
  await db.execute(
    `INSERT INTO session_worktrees (id, session_id, worktree_path, branch, parallel_index, project_id, created_at)
     VALUES (?, ?, ?, 'main', ?, ?, ?)`,
    [
      `wt-${sessionId}-${projectId}`,
      sessionId,
      `/tmp/wt/${sessionId}/${index}`,
      index,
      projectId,
      NOW,
    ],
  );
};

const sessionWorkspaces = async ({ db }: { readonly db: Db }) =>
  db.select<{ readonly id: string; readonly workspace_id: string }>(
    'SELECT id, workspace_id FROM sessions ORDER BY id',
  );

describe('describeProjectAdoption', () => {
  it('reports a 1:1 shell with every visible workspace session', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s', workspaceId: source });
    await addSession({ db, id: 'sess-1', workspaceId: source, activeProjectId: 'proj-s' });
    await addSession({ db, id: 'sess-2', workspaceId: source, archived: true });
    await addSession({ db, id: 'sess-3', workspaceId: source, deleted: true });

    const info = await describeProjectAdoption({ db, projectId: 'proj-s' as ProjectId });

    expect(info).toEqual({ sourceWorkspaceId: source, isShell: true, sessionCount: 2 });
  });

  it('reports a multi-project source with only the sessions touching the project', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-a', workspaceId: source });
    await addProject({ db, id: 'proj-b', workspaceId: source });
    await addSession({ db, id: 'sess-a', workspaceId: source, activeProjectId: 'proj-a' });
    await addSession({ db, id: 'sess-b', workspaceId: source, activeProjectId: 'proj-b' });
    await addSession({ db, id: 'sess-none', workspaceId: source });

    const info = await describeProjectAdoption({ db, projectId: 'proj-a' as ProjectId });

    expect(info).toEqual({ sourceWorkspaceId: source, isShell: false, sessionCount: 1 });
  });

  it('treats a source whose other projects are disconnected as a shell', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-a', workspaceId: source });
    await addProject({ db, id: 'proj-gone', workspaceId: source, disconnected: true });

    const info = await describeProjectAdoption({ db, projectId: 'proj-a' as ProjectId });

    expect(info?.isShell).toBe(true);
  });

  it('returns null for an unknown project', async () => {
    const db = await seed();

    expect(await describeProjectAdoption({ db, projectId: 'ghost' as ProjectId })).toBeNull();
  });
});

describe('moveProjectToWorkspace', () => {
  it('moves the project and its sessions, active and archived, to the target', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-a', workspaceId: source });
    await addProject({ db, id: 'proj-b', workspaceId: source });
    await addSession({ db, id: 'sess-active', workspaceId: source, activeProjectId: 'proj-a' });
    await addSession({
      db,
      id: 'sess-archived',
      workspaceId: source,
      activeProjectId: 'proj-a',
      archived: true,
    });
    await addSession({ db, id: 'sess-mounted', workspaceId: source });
    await addMount({ db, sessionId: 'sess-mounted', projectId: 'proj-a' });
    await addSession({ db, id: 'sess-other', workspaceId: source, activeProjectId: 'proj-b' });

    const result = await moveProjectToWorkspace({
      db,
      projectId: 'proj-a' as ProjectId,
      targetWorkspaceId: target,
    });

    expect(result).toEqual({ movedSessionCount: 3, ambiguousSessionCount: 0 });
    expect(await sessionWorkspaces({ db })).toEqual([
      { id: 'sess-active', workspace_id: target },
      { id: 'sess-archived', workspace_id: target },
      { id: 'sess-mounted', workspace_id: target },
      { id: 'sess-other', workspace_id: source },
    ]);
    const projects = await db.select<{ readonly id: string; readonly workspace_id: string }>(
      'SELECT id, workspace_id FROM projects ORDER BY id',
    );
    expect(projects).toEqual([
      { id: 'proj-a', workspace_id: target },
      { id: 'proj-b', workspace_id: source },
    ]);
  });

  it('leaves sessions that also touch other source projects and reports them', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-a', workspaceId: source });
    await addProject({ db, id: 'proj-b', workspaceId: source });
    await addSession({ db, id: 'sess-solo', workspaceId: source, activeProjectId: 'proj-a' });
    await addSession({ db, id: 'sess-both', workspaceId: source, activeProjectId: 'proj-a' });
    await addMount({ db, sessionId: 'sess-both', projectId: 'proj-a' });
    await addMount({ db, sessionId: 'sess-both', projectId: 'proj-b', index: 1 });
    await addSession({ db, id: 'sess-cross', workspaceId: source, activeProjectId: 'proj-b' });
    await addMount({ db, sessionId: 'sess-cross', projectId: 'proj-a' });

    const result = await moveProjectToWorkspace({
      db,
      projectId: 'proj-a' as ProjectId,
      targetWorkspaceId: target,
    });

    expect(result).toEqual({ movedSessionCount: 1, ambiguousSessionCount: 2 });
    expect(await sessionWorkspaces({ db })).toEqual([
      { id: 'sess-both', workspace_id: source },
      { id: 'sess-cross', workspace_id: source },
      { id: 'sess-solo', workspace_id: target },
    ]);
  });

  it('carries project scoped bindings and permission rules to the target', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-a', workspaceId: source });
    await addProject({ db, id: 'proj-b', workspaceId: source });
    await db.execute(
      `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
       VALUES ('cred-1', 'linear', 'Dev', 'team', ?, ?)`,
      [NOW, NOW],
    );
    await db.execute(
      `INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
       VALUES ('bind-1', ?, 'proj-a', 'linear', 'cred-1', '{}', ?, ?)`,
      [source, NOW, NOW],
    );
    await db.execute(
      `INSERT INTO permission_rules (id, scope, workspace_id, project_id, pattern_tool, decision, created_at, updated_at)
       VALUES ('rule-1', 'project', ?, 'proj-a', 'Bash', 'allow', ?, ?)`,
      [source, NOW, NOW],
    );

    await moveProjectToWorkspace({
      db,
      projectId: 'proj-a' as ProjectId,
      targetWorkspaceId: target,
    });

    const bindings = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM integration_bindings WHERE id = 'bind-1'",
    );
    expect(bindings[0]?.workspace_id).toBe(target);
    const rules = await db.select<{ readonly workspace_id: string }>(
      "SELECT workspace_id FROM permission_rules WHERE id = 'rule-1'",
    );
    expect(rules[0]?.workspace_id).toBe(target);
  });

  it('does nothing when the project already lives in the target', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-t', workspaceId: target });

    const result = await moveProjectToWorkspace({
      db,
      projectId: 'proj-t' as ProjectId,
      targetWorkspaceId: target,
    });

    expect(result).toEqual({ movedSessionCount: 0, ambiguousSessionCount: 0 });
  });

  it('refuses an unknown target workspace', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-a', workspaceId: source });

    await expect(
      moveProjectToWorkspace({
        db,
        projectId: 'proj-a' as ProjectId,
        targetWorkspaceId: 'ws-ghost' as WorkspaceId,
      }),
    ).rejects.toThrow(/workspace not found/);
  });
});
