import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import { listWorkspaceMergeCandidates, mergeWorkspaces } from './workspace-merge';

const target = 'ws-target' as WorkspaceId;
const source = 'ws-source' as WorkspaceId;
const sourceB = 'ws-source-b' as WorkspaceId;

const NOW = 1755900000000;

const seed = async () => {
  const db = makeTestDatabase();
  await migrate(db);
  const ordered = [target, source, sourceB];
  for (const [index, id] of ordered.entries()) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, id, id, NOW + index, NOW + index],
    );
  }
  await db.execute(
    `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
     VALUES ('cred-1', 'linear', 'Dev', 'team', ?, ?)`,
    [NOW, NOW],
  );
  return db;
};

type Db = Awaited<ReturnType<typeof seed>>;

const addProject = async ({
  db,
  id,
  workspaceId,
}: {
  readonly db: Db;
  readonly id: string;
  readonly workspaceId: WorkspaceId;
}) => {
  await db.execute(
    `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'repo', ?, ?)`,
    [id, workspaceId, id, `/tmp/${id}`, NOW, NOW],
  );
};

const addSession = async ({
  db,
  id,
  workspaceId,
}: {
  readonly db: Db;
  readonly id: string;
  readonly workspaceId: WorkspaceId;
}) => {
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at)
     VALUES (?, ?, 'goal', 'idle', ?, ?)`,
    [id, workspaceId, NOW, NOW],
  );
};

const addBinding = async ({
  db,
  id,
  workspaceId,
  projectId,
  config,
}: {
  readonly db: Db;
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: string | null;
  readonly config: string;
}) => {
  await db.execute(
    `INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
     VALUES (?, ?, ?, 'linear', 'cred-1', ?, ?, ?)`,
    [id, workspaceId, projectId, config, NOW, NOW],
  );
};

type BindingRow = {
  readonly id: string;
  readonly workspace_id: string;
  readonly project_id: string | null;
  readonly provider: string;
  readonly config: string;
};

const bindingsOf = async ({
  db,
  workspaceId,
}: {
  readonly db: Db;
  readonly workspaceId: WorkspaceId;
}) =>
  db.select<BindingRow>(
    'SELECT id, workspace_id, project_id, provider, config FROM integration_bindings WHERE workspace_id = ? ORDER BY provider, project_id',
    [workspaceId],
  );

describe('mergeWorkspaces', () => {
  it('moves projects and sessions to the target and deletes the emptied source', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-t', workspaceId: target });
    await addProject({ db, id: 'proj-s', workspaceId: source });
    await addSession({ db, id: 'sess-s', workspaceId: source });

    await mergeWorkspaces({ db, sourceWorkspaceIds: [source], targetWorkspaceId: target });

    const projects = await db.select<{ id: string; workspace_id: string }>(
      'SELECT id, workspace_id FROM projects ORDER BY id',
    );
    expect(projects).toEqual([
      { id: 'proj-s', workspace_id: target },
      { id: 'proj-t', workspace_id: target },
    ]);
    const sessions = await db.select<{ id: string; workspace_id: string }>(
      'SELECT id, workspace_id FROM sessions',
    );
    expect(sessions).toEqual([{ id: 'sess-s', workspace_id: target }]);
    const workspaces = await db.select<{ id: string }>('SELECT id FROM workspaces ORDER BY id');
    expect(workspaces).toEqual([{ id: 'ws-source-b' }, { id: 'ws-target' }]);
  });

  it('moves a workspace-level binding when the target lacks that provider', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s', workspaceId: source });
    await addBinding({ db, id: 'bind-s', workspaceId: source, projectId: null, config: '{"a":1}' });

    await mergeWorkspaces({ db, sourceWorkspaceIds: [source], targetWorkspaceId: target });

    expect(await bindingsOf({ db, workspaceId: target })).toEqual([
      {
        id: 'bind-s',
        workspace_id: target,
        project_id: null,
        provider: 'linear',
        config: '{"a":1}',
      },
    ]);
  });

  it('converts a conflicting binding into a project override when the source has one project', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s', workspaceId: source });
    await addBinding({ db, id: 'bind-t', workspaceId: target, projectId: null, config: '{"a":1}' });
    await addBinding({ db, id: 'bind-s', workspaceId: source, projectId: null, config: '{"a":2}' });

    await mergeWorkspaces({ db, sourceWorkspaceIds: [source], targetWorkspaceId: target });

    expect(await bindingsOf({ db, workspaceId: target })).toEqual([
      {
        id: 'bind-t',
        workspace_id: target,
        project_id: null,
        provider: 'linear',
        config: '{"a":1}',
      },
      {
        id: 'bind-s',
        workspace_id: target,
        project_id: 'proj-s',
        provider: 'linear',
        config: '{"a":2}',
      },
    ]);
  });

  it('fans a differing binding out to every source project when the source has several', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s1', workspaceId: source });
    await addProject({ db, id: 'proj-s2', workspaceId: source });
    await addBinding({ db, id: 'bind-t', workspaceId: target, projectId: null, config: '{"a":1}' });
    await addBinding({ db, id: 'bind-s', workspaceId: source, projectId: null, config: '{"a":2}' });

    await mergeWorkspaces({ db, sourceWorkspaceIds: [source], targetWorkspaceId: target });

    const rows = await bindingsOf({ db, workspaceId: target });
    expect(rows.filter((row) => row.project_id === null)).toEqual([
      {
        id: 'bind-t',
        workspace_id: target,
        project_id: null,
        provider: 'linear',
        config: '{"a":1}',
      },
    ]);
    expect(
      rows
        .filter((row) => row.project_id !== null)
        .map((row) => ({ project: row.project_id, config: row.config })),
    ).toEqual([
      { project: 'proj-s1', config: '{"a":2}' },
      { project: 'proj-s2', config: '{"a":2}' },
    ]);
  });

  it('discards a duplicate binding whose config matches the target', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s1', workspaceId: source });
    await addProject({ db, id: 'proj-s2', workspaceId: source });
    await addBinding({ db, id: 'bind-t', workspaceId: target, projectId: null, config: '{"a":1}' });
    await addBinding({
      db,
      id: 'bind-s',
      workspaceId: source,
      projectId: null,
      config: '{"a": 1}',
    });

    await mergeWorkspaces({ db, sourceWorkspaceIds: [source], targetWorkspaceId: target });

    expect(await bindingsOf({ db, workspaceId: target })).toEqual([
      {
        id: 'bind-t',
        workspace_id: target,
        project_id: null,
        provider: 'linear',
        config: '{"a":1}',
      },
    ]);
  });

  it('carries project-level source bindings across untouched', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s', workspaceId: source });
    await addBinding({
      db,
      id: 'bind-sp',
      workspaceId: source,
      projectId: 'proj-s',
      config: '{"a":3}',
    });

    await mergeWorkspaces({ db, sourceWorkspaceIds: [source], targetWorkspaceId: target });

    expect(await bindingsOf({ db, workspaceId: target })).toEqual([
      {
        id: 'bind-sp',
        workspace_id: target,
        project_id: 'proj-s',
        provider: 'linear',
        config: '{"a":3}',
      },
    ]);
  });

  it('keeps the target profile and drops the source profile and branch prefix', async () => {
    const db = await seed();
    await db.execute(
      `INSERT INTO workspace_profiles (workspace_id, bio, updated_at)
       VALUES (?, 'I write code.', ?)`,
      [target, NOW],
    );
    await db.execute(
      `INSERT INTO workspace_profiles (workspace_id, bio, updated_at)
       VALUES (?, 'I do not write code.', ?)`,
      [source, NOW],
    );
    await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
      `workspace.${source}.branch_prefix`,
      'src',
      NOW,
    ]);
    await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', [
      `workspace.${target}.branch_prefix`,
      'tgt',
      NOW,
    ]);

    await mergeWorkspaces({ db, sourceWorkspaceIds: [source], targetWorkspaceId: target });

    const profiles = await db.select<{ workspace_id: string; bio: string }>(
      'SELECT workspace_id, bio FROM workspace_profiles',
    );
    expect(profiles).toEqual([{ workspace_id: target, bio: 'I write code.' }]);
    const settings = await db.select<{ key: string; value: string }>(
      "SELECT key, value FROM settings WHERE key LIKE '%.branch_prefix'",
    );
    expect(settings).toEqual([{ key: `workspace.${target}.branch_prefix`, value: 'tgt' }]);
  });

  it('merges several sources in one call and leaves session events alone', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s', workspaceId: source });
    await addProject({ db, id: 'proj-b', workspaceId: sourceB });
    await addSession({ db, id: 'sess-s', workspaceId: source });
    await db.execute(
      `INSERT INTO session_events (id, session_id, kind, payload_json, created_at)
       VALUES ('ev-1', 'sess-s', 'worktree_created', '{}', ?)`,
      [NOW],
    );

    await mergeWorkspaces({
      db,
      sourceWorkspaceIds: [source, sourceB],
      targetWorkspaceId: target,
    });

    const workspaces = await db.select<{ id: string }>('SELECT id FROM workspaces');
    expect(workspaces).toEqual([{ id: 'ws-target' }]);
    const events = await db.select<{ id: string; session_id: string }>(
      'SELECT id, session_id FROM session_events',
    );
    expect(events).toEqual([{ id: 'ev-1', session_id: 'sess-s' }]);
  });

  it('rolls back the whole merge when one source is missing', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s', workspaceId: source });

    await expect(
      mergeWorkspaces({
        db,
        sourceWorkspaceIds: [source, 'ws-ghost' as WorkspaceId],
        targetWorkspaceId: target,
      }),
    ).rejects.toThrow(/workspace not found/);

    const projects = await db.select<{ id: string; workspace_id: string }>(
      'SELECT id, workspace_id FROM projects',
    );
    expect(projects).toEqual([{ id: 'proj-s', workspace_id: source }]);
    const workspaces = await db.select<{ id: string }>('SELECT id FROM workspaces ORDER BY id');
    expect(workspaces).toHaveLength(3);
  });

  it('ignores the target itself when passed among the sources', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-t', workspaceId: target });

    await mergeWorkspaces({
      db,
      sourceWorkspaceIds: [target],
      targetWorkspaceId: target,
    });

    const workspaces = await db.select<{ id: string }>('SELECT id FROM workspaces');
    expect(workspaces).toHaveLength(3);
  });
});

describe('listWorkspaceMergeCandidates', () => {
  it('lists the other workspaces with their project and session counts', async () => {
    const db = await seed();
    await addProject({ db, id: 'proj-s', workspaceId: source });
    await addProject({ db, id: 'proj-s2', workspaceId: source });
    await addSession({ db, id: 'sess-s', workspaceId: source });

    const candidates = await listWorkspaceMergeCandidates({ db, targetWorkspaceId: target });

    expect(candidates).toEqual([
      { id: sourceB, name: 'ws-source-b', projectCount: 0, sessionCount: 0 },
      { id: source, name: 'ws-source', projectCount: 2, sessionCount: 1 },
    ]);
  });
});
