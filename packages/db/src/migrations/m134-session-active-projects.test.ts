import { describe, expect, it } from 'vitest';
import type { Database } from '../client';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from './index';
import { migrate } from './runner';

const NOW = Date.parse('2026-08-24T10:00:00.000Z');

type WorkspaceParams = {
  readonly db: Database;
  readonly id: string;
};

const insertWorkspace = async ({ db, id }: WorkspaceParams): Promise<void> => {
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, id, id, NOW, NOW],
  );
};

type ProjectParams = {
  readonly db: Database;
  readonly id: string;
  readonly workspaceId: string;
};

const insertProject = async ({ db, id, workspaceId }: ProjectParams): Promise<void> => {
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'repo', ?, ?)`,
    [id, workspaceId, id, `/repos/${id}`, NOW, NOW],
  );
};

type SessionParams = {
  readonly db: Database;
  readonly id: string;
  readonly workspaceId: string;
  readonly activeProjectId?: string | null;
};

const insertSession = async ({
  db,
  id,
  workspaceId,
  activeProjectId = null,
}: SessionParams): Promise<void> => {
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, active_project_id, created_at, updated_at)
     VALUES (?, ?, 'Goal', 'idle', ?, ?, ?)`,
    [id, workspaceId, activeProjectId, NOW, NOW],
  );
};

type WorktreeParams = {
  readonly db: Database;
  readonly id: string;
  readonly sessionId: string;
  readonly projectId: string | null;
  readonly parallelIndex: number;
};

const insertWorktree = async ({
  db,
  id,
  sessionId,
  projectId,
  parallelIndex,
}: WorktreeParams): Promise<void> => {
  await db.execute(
    `INSERT INTO session_worktrees (id, session_id, worktree_path, branch, parallel_index, project_id, created_at)
     VALUES (?, ?, ?, 'main', ?, ?, ?)`,
    [id, sessionId, `/worktrees/${id}`, parallelIndex, projectId, NOW],
  );
};

const seedThrough133 = async (): Promise<Database> => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= 133),
  );
  return db;
};

const readActiveProjects = async (db: Database): Promise<ReadonlyArray<string | null>> => {
  const rows = await db.select<{ id: string; active_project_id: string | null }>(
    'SELECT id, active_project_id FROM sessions ORDER BY id ASC',
  );
  return rows.map((row) => row.active_project_id);
};

describe('m134 session active projects', () => {
  it('adopts the project of the primary worktree', async () => {
    const db = await seedThrough133();
    await insertWorkspace({ db, id: 'workspace-1' });
    await insertProject({ db, id: 'project-api', workspaceId: 'workspace-1' });
    await insertProject({ db, id: 'project-web', workspaceId: 'workspace-1' });
    await insertSession({ db, id: 'session-1', workspaceId: 'workspace-1' });
    await insertWorktree({
      db,
      id: 'worktree-parallel',
      sessionId: 'session-1',
      projectId: 'project-web',
      parallelIndex: 1,
    });
    await insertWorktree({
      db,
      id: 'worktree-primary',
      sessionId: 'session-1',
      projectId: 'project-api',
      parallelIndex: 0,
    });

    await migrate(db, migrations);

    expect(await readActiveProjects(db)).toEqual(['project-api']);
  });

  it('ignores a worktree whose project left the workspace', async () => {
    const db = await seedThrough133();
    await insertWorkspace({ db, id: 'workspace-1' });
    await insertWorkspace({ db, id: 'workspace-2' });
    await insertProject({ db, id: 'project-home', workspaceId: 'workspace-1' });
    await insertProject({ db, id: 'project-away', workspaceId: 'workspace-2' });
    await insertSession({ db, id: 'session-1', workspaceId: 'workspace-1' });
    await insertWorktree({
      db,
      id: 'worktree-away',
      sessionId: 'session-1',
      projectId: 'project-away',
      parallelIndex: 0,
    });
    await insertWorktree({
      db,
      id: 'worktree-home',
      sessionId: 'session-1',
      projectId: 'project-home',
      parallelIndex: 1,
    });

    await migrate(db, migrations);

    expect(await readActiveProjects(db)).toEqual(['project-home']);
  });

  it('falls back to the only project of the workspace', async () => {
    const db = await seedThrough133();
    await insertWorkspace({ db, id: 'workspace-1' });
    await insertProject({ db, id: 'project-api', workspaceId: 'workspace-1' });
    await insertSession({ db, id: 'session-1', workspaceId: 'workspace-1' });

    await migrate(db, migrations);

    expect(await readActiveProjects(db)).toEqual(['project-api']);
  });

  it('leaves a session bare when the workspace holds several projects', async () => {
    const db = await seedThrough133();
    await insertWorkspace({ db, id: 'workspace-1' });
    await insertProject({ db, id: 'project-api', workspaceId: 'workspace-1' });
    await insertProject({ db, id: 'project-web', workspaceId: 'workspace-1' });
    await insertSession({ db, id: 'session-1', workspaceId: 'workspace-1' });

    await migrate(db, migrations);

    expect(await readActiveProjects(db)).toEqual([null]);
  });

  it('keeps a project the session already points at', async () => {
    const db = await seedThrough133();
    await insertWorkspace({ db, id: 'workspace-1' });
    await insertProject({ db, id: 'project-api', workspaceId: 'workspace-1' });
    await insertProject({ db, id: 'project-web', workspaceId: 'workspace-1' });
    await insertSession({
      db,
      id: 'session-1',
      workspaceId: 'workspace-1',
      activeProjectId: 'project-web',
    });
    await insertWorktree({
      db,
      id: 'worktree-primary',
      sessionId: 'session-1',
      projectId: 'project-api',
      parallelIndex: 0,
    });

    await migrate(db, migrations);

    expect(await readActiveProjects(db)).toEqual(['project-web']);
  });
});
