import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ProjectId,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { migrations } from '../migrations';
import {
  deleteSessionExternalTask,
  listExternalTasksForWorkspace,
  upsertSessionExternalTask,
} from './session-external-task';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;

type SeedParams = {
  readonly throughVersion?: number;
};

const LATEST_VERSION = migrations[migrations.length - 1]?.version ?? 0;

const seed = async ({ throughVersion = LATEST_VERSION }: SeedParams) => {
  const db = await makeMigratedTestDatabase({ throughVersion });
  const now = Date.now();
  if (throughVersion < 118) {
    await db.execute(
      `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [workspaceId, 'ws', '/tmp/ws', now, now],
    );
  } else {
    await db.execute(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [workspaceId, 'ws', 'ws', now, now],
    );
  }
  await db.execute(
    `INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, workspaceId, 'goal', 'idle', now, now],
  );
  return db;
};

type ListSessionTasksParams = {
  readonly db: Database;
};

const listSessionTasks = async ({
  db,
}: ListSessionTasksParams): Promise<ReadonlyArray<SessionExternalTask>> => {
  const rows = await db.select<{ readonly workspace_id: string }>(
    'SELECT workspace_id FROM sessions WHERE id = ?',
    [sessionId],
  );
  const owner = rows[0];
  if (owner === undefined) {
    return [];
  }
  return listExternalTasksForWorkspace({ db, workspaceId: owner.workspace_id as WorkspaceId });
};

type MakeTaskParams = {
  readonly overrides?: Partial<SessionExternalTask>;
};

const makeTask = ({ overrides = {} }: MakeTaskParams): SessionExternalTask => ({
  sessionId,
  provider: 'linear',
  externalId: 'lin-uuid-1',
  identifier: 'SER-123',
  url: 'https://linear.app/demo-team/issue/SER-123',
  title: 'Add user signup',
  createdAt: new Date('2026-05-21T10:00:00Z').toISOString() as IsoDateTime,
  ...overrides,
});

describe('session_external_tasks queries', () => {
  it('stores and lists multiple links for one session', async () => {
    const db = await seed({});
    const linear = makeTask({});
    const sentry = makeTask({
      overrides: {
        provider: 'sentry',
        externalId: 'sentry-42',
        identifier: 'GOODBOY-7A',
        url: 'https://sentry.io/organizations/goodboy/issues/42/',
        title: 'TypeError',
      },
    });
    await upsertSessionExternalTask({ db, task: linear });
    await upsertSessionExternalTask({ db, task: sentry });

    const forSession = await listSessionTasks({ db });
    const forWorkspace = await listSessionTasks({ db });
    expect(forSession.map((task) => task.provider)).toEqual(['linear', 'sentry']);
    expect(forWorkspace).toEqual(forSession);
  });

  it('upserts only the matching composite key', async () => {
    const db = await seed({});
    const original = makeTask({});
    const other = makeTask({
      overrides: {
        provider: 'gitlab',
        externalId: '101',
        identifier: 'acme/web#7',
        url: 'https://gitlab.com/acme/web/-/issues/7',
      },
    });
    await upsertSessionExternalTask({ db, task: original });
    await upsertSessionExternalTask({ db, task: other });
    await upsertSessionExternalTask({
      db,
      task: makeTask({ overrides: { identifier: 'SER-999', title: 'Renamed' } }),
    });

    const tasks = await listSessionTasks({ db });
    expect(
      tasks.map(({ provider, identifier, title }) => ({ provider, identifier, title })),
    ).toEqual([
      { provider: 'gitlab', identifier: 'acme/web#7', title: 'Add user signup' },
      { provider: 'linear', identifier: 'SER-999', title: 'Renamed' },
    ]);
  });

  it('stores the same external id independently for different mounts', async () => {
    const db = await seed({});
    const webId = 'project-web' as ProjectId;
    const apiId = 'project-api' as ProjectId;
    const now = Date.now();
    for (const projectId of [webId, apiId]) {
      await db.execute(
        `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'repo', ?, ?)`,
        [projectId, workspaceId, projectId, `/tmp/${projectId}`, now, now],
      );
    }
    const web = makeTask({ overrides: { projectId: webId, title: 'Web issue' } });
    const api = makeTask({ overrides: { projectId: apiId, title: 'API issue' } });

    await upsertSessionExternalTask({ db, task: web });
    await upsertSessionExternalTask({ db, task: api });

    expect(await listSessionTasks({ db })).toEqual([api, web]);

    await deleteSessionExternalTask({
      db,
      sessionId,
      provider: web.provider,
      externalId: web.externalId,
      projectId: webId,
    });

    expect(await listSessionTasks({ db })).toEqual([api]);
  });

  it('rejects an unknown provider', async () => {
    const db = await seed({});
    await expect(
      upsertSessionExternalTask({
        db,
        task: makeTask({ overrides: { provider: 'asana' as never } }),
      }),
    ).rejects.toThrow(/invalid external task provider/);
  });

  it('deletes only the matching composite key', async () => {
    const db = await seed({});
    await upsertSessionExternalTask({ db, task: makeTask({}) });
    await upsertSessionExternalTask({
      db,
      task: makeTask({
        overrides: { provider: 'sentry', externalId: '42', identifier: 'GOODBOY-42' },
      }),
    });

    await deleteSessionExternalTask({
      db,
      sessionId,
      provider: 'linear',
      externalId: 'lin-uuid-1',
    });

    const tasks = await listSessionTasks({ db });
    expect(tasks.map((task) => task.identifier)).toEqual(['GOODBOY-42']);
  });

  it('cascade deletes every link with its session', async () => {
    const db = await seed({});
    await upsertSessionExternalTask({ db, task: makeTask({}) });
    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    expect(await listSessionTasks({ db })).toEqual([]);
  });

  it('keeps the branch an issue was linked on', async () => {
    const db = await seed({});
    const stamped = makeTask({ overrides: { branch: 'ak/fix-auth' } });
    await upsertSessionExternalTask({ db, task: stamped });

    expect(await listSessionTasks({ db })).toEqual([stamped]);
  });

  it('keeps the branch a session link was written with when it is linked again without one', async () => {
    const db = await seed({});
    await upsertSessionExternalTask({
      db,
      task: makeTask({ overrides: { branch: 'hl/fix-auth' } }),
    });
    await upsertSessionExternalTask({ db, task: makeTask({ overrides: { title: 'Renamed' } }) });

    expect(await listSessionTasks({ db })).toEqual([
      makeTask({ overrides: { branch: 'hl/fix-auth', title: 'Renamed' } }),
    ]);
  });

  it('keeps a session link and a branch link of the same task apart, and never duplicates either', async () => {
    const db = await seed({});
    const onSession = makeTask({ overrides: { branch: 'hl/fix-auth' } });
    const onBranch = makeTask({ overrides: { branch: 'hl/fix-auth', scope: 'branch' } });
    const onOtherBranch = makeTask({ overrides: { branch: 'hl/auth-copy', scope: 'branch' } });

    for (const task of [onSession, onBranch, onOtherBranch, onBranch, onSession]) {
      await upsertSessionExternalTask({ db, task });
    }

    expect(await listSessionTasks({ db })).toEqual([onSession, onOtherBranch, onBranch]);
  });

  it('stores the relation a link was written with and updates it on the next link', async () => {
    const db = await seed({});
    await upsertSessionExternalTask({ db, task: makeTask({ overrides: { relation: 'part-of' } }) });
    expect(await listSessionTasks({ db })).toEqual([
      makeTask({ overrides: { relation: 'part-of' } }),
    ]);

    await upsertSessionExternalTask({ db, task: makeTask({}) });
    expect(await listSessionTasks({ db })).toEqual([makeTask({})]);
  });

  it('refuses a branch link without a branch', async () => {
    const db = await seed({});
    await expect(
      upsertSessionExternalTask({ db, task: makeTask({ overrides: { scope: 'branch' } }) }),
    ).rejects.toThrow(/needs a branch/);
  });

  it('removes only the link of the scope it names', async () => {
    const db = await seed({});
    const onSession = makeTask({ overrides: { branch: 'hl/fix-auth' } });
    const onBranch = makeTask({ overrides: { branch: 'hl/fix-auth', scope: 'branch' } });
    await upsertSessionExternalTask({ db, task: onSession });
    await upsertSessionExternalTask({ db, task: onBranch });

    await deleteSessionExternalTask({
      db,
      sessionId,
      provider: 'linear',
      externalId: 'lin-uuid-1',
      scope: 'branch',
      branch: 'hl/fix-auth',
    });
    expect(await listSessionTasks({ db })).toEqual([onSession]);

    await deleteSessionExternalTask({
      db,
      sessionId,
      provider: 'linear',
      externalId: 'lin-uuid-1',
    });
    expect(await listSessionTasks({ db })).toEqual([]);
  });

  it('finds a link through the identity index', async () => {
    const db = await seed({});
    const plan = await db.select<{ readonly detail: string }>(
      `EXPLAIN QUERY PLAN
       DELETE FROM session_external_tasks
        WHERE session_id = ?
          AND provider = ?
          AND external_id = ?
          AND COALESCE(project_id, '') = ?
          AND COALESCE(CASE scope WHEN 'branch' THEN branch END, '') = ?`,
      [sessionId, 'linear', 'lin-uuid-1', '', ''],
    );
    expect(plan.map((row) => row.detail).join('\n')).toContain(
      'USING INDEX idx_session_external_tasks_identity',
    );
  });
});
