import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ProjectId,
  SessionExternalTask,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from '../migrations';
import { migrate } from '../migrations/runner';
import {
  deleteSessionExternalTask,
  listExternalTasksForWorkspace,
  listSessionExternalTasks,
  upsertSessionExternalTask,
} from './session-external-task';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;

type SeedParams = {
  readonly throughVersion?: number;
};

const LATEST_VERSION = migrations[migrations.length - 1]?.version ?? 0;

const seed = async ({ throughVersion = LATEST_VERSION }: SeedParams) => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= throughVersion),
  );
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

    const forSession = await listSessionExternalTasks({ db, sessionId });
    const forWorkspace = await listExternalTasksForWorkspace({ db, workspaceId });
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

    const tasks = await listSessionExternalTasks({ db, sessionId });
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

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([api, web]);

    await deleteSessionExternalTask({
      db,
      sessionId,
      provider: web.provider,
      externalId: web.externalId,
      projectId: webId,
    });

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([api]);
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

    const tasks = await listSessionExternalTasks({ db, sessionId });
    expect(tasks.map((task) => task.identifier)).toEqual(['GOODBOY-42']);
  });

  it('cascade deletes every link with its session', async () => {
    const db = await seed({});
    await upsertSessionExternalTask({ db, task: makeTask({}) });
    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([]);
  });

  it('preserves an existing row while removing the one-link constraint', async () => {
    const db = await seed({ throughVersion: 70 });
    const original = makeTask({});
    await db.execute(
      `INSERT INTO session_external_tasks
        (session_id, provider, external_id, identifier, url, title, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        original.sessionId,
        original.provider,
        original.externalId,
        original.identifier,
        original.url,
        original.title,
        Date.parse(original.createdAt),
      ],
    );
    await migrate(db, migrations);

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([original]);
  });

  it('preserves existing rows while allowing GitHub links', async () => {
    const db = await seed({ throughVersion: 72 });
    const gitlab = makeTask({
      overrides: {
        provider: 'gitlab',
        externalId: 'gitlab-12',
        identifier: '#12',
        url: 'https://gitlab.com/goodboy/goodboy/-/issues/12',
        title: 'Keep this link',
      },
    });
    await db.execute(
      `INSERT INTO session_external_tasks
        (session_id, provider, external_id, identifier, url, title, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        gitlab.sessionId,
        gitlab.provider,
        gitlab.externalId,
        gitlab.identifier,
        gitlab.url,
        gitlab.title,
        Date.parse(gitlab.createdAt),
      ],
    );
    await migrate(db, migrations);
    const github = makeTask({
      overrides: {
        provider: 'github',
        externalId: '34',
        identifier: '#34',
        url: 'https://github.com/goodboy/goodboy/issues/34',
        title: 'Add GitHub issues',
      },
    });
    await upsertSessionExternalTask({ db, task: github });

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([github, gitlab]);
  });

  it('preserves existing links with null mount attribution', async () => {
    const db = await seed({ throughVersion: 95 });
    const original = makeTask({});
    await db.execute(
      `INSERT INTO session_external_tasks
        (session_id, provider, external_id, identifier, url, title, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        original.sessionId,
        original.provider,
        original.externalId,
        original.identifier,
        original.url,
        original.title,
        Date.parse(original.createdAt),
      ],
    );
    await migrate(db, migrations);

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([original]);
  });

  it('keeps the branch an issue was linked on', async () => {
    const db = await seed({});
    const stamped = makeTask({ overrides: { branch: 'ak/fix-auth' } });
    await upsertSessionExternalTask({ db, task: stamped });

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([stamped]);
  });

  it('keeps the original branch when the same link is upserted without one', async () => {
    const db = await seed({});
    await upsertSessionExternalTask({
      db,
      task: makeTask({ overrides: { branch: 'ak/fix-auth' } }),
    });
    await upsertSessionExternalTask({ db, task: makeTask({ overrides: { title: 'Renamed' } }) });

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([
      makeTask({ overrides: { branch: 'ak/fix-auth', title: 'Renamed' } }),
    ]);
  });
});
