import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
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

const seed = async ({ throughVersion = 71 }: SeedParams) => {
  const db = makeTestDatabase();
  await migrate(
    db,
    migrations.filter((migration) => migration.version <= throughVersion),
  );
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [workspaceId, 'ws', '/tmp/ws', now, now],
  );
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
  url: 'https://linear.app/serenis/issue/SER-123',
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

  it('rejects an unknown provider', async () => {
    const db = await seed({});
    await expect(
      upsertSessionExternalTask({
        db,
        task: makeTask({ overrides: { provider: 'asana' as never } }),
      }),
    ).rejects.toThrow(/CHECK constraint/);
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
    const migration = migrations.find((candidate) => candidate.version === 71);
    if (migration == null) {
      throw new Error('Migration 71 should exist');
    }

    await migrate(db, [migration]);

    expect(await listSessionExternalTasks({ db, sessionId })).toEqual([original]);
  });
});
