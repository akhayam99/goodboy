import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from '../migrations/runner';
import {
  getSessionExternalTask,
  removeSessionExternalTask,
  setSessionExternalTask,
} from './session-external-task';

const workspaceId = 'w1' as WorkspaceId;
const sessionId = 's1' as SessionId;

async function seed() {
  const db = makeTestDatabase();
  await migrate(db);
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
}

function makeTask(overrides: Partial<SessionExternalTask> = {}): SessionExternalTask {
  return {
    sessionId,
    provider: 'linear',
    externalId: 'lin-uuid-1',
    identifier: 'SER-123',
    url: 'https://linear.app/serenis/issue/SER-123',
    title: 'Add user signup',
    createdAt: new Date('2026-05-21T10:00:00Z').toISOString() as IsoDateTime,
    ...overrides,
  };
}

describe('session_external_tasks queries', () => {
  it('set + get round-trip', async () => {
    const db = await seed();
    const task = makeTask();
    await setSessionExternalTask(db, task);

    const got = await getSessionExternalTask(db, sessionId);
    expect(got).not.toBeNull();
    expect(got!.identifier).toBe('SER-123');
    expect(got!.url).toBe(task.url);
    expect(got!.title).toBe(task.title);
  });

  it('persists a sentry-provider task (widened provider CHECK)', async () => {
    const db = await seed();
    const task = makeTask({
      provider: 'sentry',
      externalId: 'sentry-issue-42',
      identifier: 'GOODBOY-7A',
      url: 'https://sentry.io/organizations/goodboy/issues/42/',
      title: 'TypeError: undefined is not a function',
    });
    await setSessionExternalTask(db, task);

    const got = await getSessionExternalTask(db, sessionId);
    expect(got!.provider).toBe('sentry');
    expect(got!.externalId).toBe('sentry-issue-42');
    expect(got!.identifier).toBe('GOODBOY-7A');
  });

  it('round-trips a gitlab-provider task', async () => {
    const db = await seed();
    const task = makeTask({
      provider: 'gitlab',
      externalId: '101',
      identifier: 'acme/web#7',
      url: 'https://gitlab.com/acme/web/-/issues/7',
    });
    await setSessionExternalTask(db, task);

    const got = await getSessionExternalTask(db, sessionId);
    expect(got!.provider).toBe('gitlab');
    expect(got!.externalId).toBe('101');
    expect(got!.identifier).toBe('acme/web#7');
  });

  it('rejects an unknown provider via the CHECK constraint', async () => {
    const db = await seed();
    await expect(
      setSessionExternalTask(db, makeTask({ provider: 'asana' as never })),
    ).rejects.toThrow(/CHECK constraint/);
  });

  it('set on conflict replaces fields (1:1 per session)', async () => {
    const db = await seed();
    await setSessionExternalTask(db, makeTask());
    await setSessionExternalTask(
      db,
      makeTask({ identifier: 'SER-999', title: 'Renamed', externalId: 'lin-uuid-2' }),
    );

    const got = await getSessionExternalTask(db, sessionId);
    expect(got!.identifier).toBe('SER-999');
    expect(got!.title).toBe('Renamed');
    expect(got!.externalId).toBe('lin-uuid-2');
  });

  it('cascade deletes on session delete', async () => {
    const db = await seed();
    await setSessionExternalTask(db, makeTask());
    await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);

    const got = await getSessionExternalTask(db, sessionId);
    expect(got).toBeNull();
  });

  it('remove drops the row without touching the session', async () => {
    const db = await seed();
    await setSessionExternalTask(db, makeTask());
    await removeSessionExternalTask(db, sessionId);

    const got = await getSessionExternalTask(db, sessionId);
    expect(got).toBeNull();
    const sessions = await db.select<{ id: string }>('SELECT id FROM sessions WHERE id = ?', [
      sessionId,
    ]);
    expect(sessions).toHaveLength(1);
  });
});
