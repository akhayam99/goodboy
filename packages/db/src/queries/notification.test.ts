import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  NOTIFICATION_LIST_LIMIT,
  clearAllNotifications,
  countNotifications,
  deleteNotification,
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from './notification';

type SeedParams = Record<string, never>;

const WS_A = 'ws-a' as WorkspaceId;
const WS_B = 'ws-b' as WorkspaceId;
const SESSION_B = 'session-b' as SessionId;

const seed = async ({}: SeedParams) => {
  const db = await makeMigratedTestDatabase();
  for (const id of [WS_A, WS_B]) {
    await db.execute(
      'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, id, id, 1, 1],
    );
  }
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [SESSION_B, WS_B, 'ship it', 'idle', 1, 1],
  );
  return db;
};

type TsParams = {
  readonly second: number;
};

const tsAt = ({ second }: TsParams) =>
  new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString() as IsoDateTime;

const buildNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n1',
  ts: '2026-08-04T10:00:00.000Z' as IsoDateTime,
  kind: 'error',
  title: 'summarizer failed',
  body: 'anthropic: request timed out',
  severity: 'error',
  sessionId: null,
  workspaceId: null,
  read: false,
  action: null,
  coalesceKey: null,
  ...overrides,
});

describe('notification queries', () => {
  it('round-trips a coalesce key', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ coalesceKey: 'error:global:error' }));

    const rows = await listNotifications({ db, workspaceId: null });

    expect(rows[0]?.coalesceKey).toBe('error:global:error');
  });
  it('marks a single notification read and leaves the others unread', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1' }));
    await insertNotification(
      db,
      buildNotification({ id: 'n2', ts: '2026-08-04T11:00:00.000Z' as IsoDateTime }),
    );

    await markNotificationRead({ db, id: 'n1' });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.find((row) => row.id === 'n1')?.read).toBe(true);
    expect(rows.find((row) => row.id === 'n2')?.read).toBe(false);
  });

  it('deletes a single notification and keeps the rest', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1' }));
    await insertNotification(
      db,
      buildNotification({ id: 'n2', ts: '2026-08-04T11:00:00.000Z' as IsoDateTime }),
    );

    await deleteNotification({ db, id: 'n2' });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.map((row) => row.id)).toEqual(['n1']);
  });

  it('marks every unread notification read', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1' }));
    await insertNotification(
      db,
      buildNotification({ id: 'n2', ts: '2026-08-04T11:00:00.000Z' as IsoDateTime }),
    );

    await markAllNotificationsRead({ db, workspaceId: null });

    const rows = await listNotifications({ db, workspaceId: null });
    expect(rows.every((row) => row.read)).toBe(true);
  });

  it('caps the list at the newest NOTIFICATION_LIST_LIMIT rows', async () => {
    const db = await seed({});
    const total = NOTIFICATION_LIST_LIMIT + 5;
    for (let index = 0; index < total; index += 1) {
      await insertNotification(
        db,
        buildNotification({
          id: `n${index}`,
          ts: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString() as IsoDateTime,
        }),
      );
    }

    const rows = await listNotifications({ db, workspaceId: null });

    expect(rows).toHaveLength(NOTIFICATION_LIST_LIMIT);
    expect(rows[0]?.id).toBe(`n${total - 1}`);
  });

  it('counts every row, including unread ones the list cap cuts off', async () => {
    const db = await seed({});
    const total = NOTIFICATION_LIST_LIMIT + 5;
    for (let index = 0; index < total; index += 1) {
      await insertNotification(
        db,
        buildNotification({ id: `n${index}`, ts: tsAt({ second: index }), read: index !== 0 }),
      );
    }

    const listed = await listNotifications({ db, workspaceId: null });
    const buckets = await countNotifications({ db, workspaceId: null });

    expect(listed.some((row) => row.id === 'n0')).toBe(false);
    expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(total);
    expect(buckets.filter((bucket) => !bucket.read)).toEqual([
      expect.objectContaining({ read: false, count: 1 }),
    ]);
  });

  it('pages older rows after a cursor, ties on the same ts included', async () => {
    const db = await seed({});
    const total = NOTIFICATION_LIST_LIMIT + 3;
    for (let index = 0; index < total; index += 1) {
      await insertNotification(
        db,
        buildNotification({ id: `n${String(index).padStart(3, '0')}`, ts: tsAt({ second: 0 }) }),
      );
    }

    const first = await listNotifications({ db, workspaceId: null });
    const last = first[first.length - 1];
    const older =
      last == null
        ? []
        : await listNotifications({ db, workspaceId: null, before: { ts: last.ts, id: last.id } });

    expect(first).toHaveLength(NOTIFICATION_LIST_LIMIT);
    expect(older.map((row) => row.id)).toEqual(['n002', 'n001', 'n000']);
  });

  it('scopes the list to a workspace, through the session, and keeps app-wide rows', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'own', workspaceId: WS_A }));
    await insertNotification(db, buildNotification({ id: 'other', workspaceId: WS_B }));
    await insertNotification(db, buildNotification({ id: 'via-session', sessionId: SESSION_B }));
    await insertNotification(db, buildNotification({ id: 'app-wide' }));

    const inA = await listNotifications({ db, workspaceId: WS_A });
    const inB = await listNotifications({ db, workspaceId: WS_B });

    expect(inA.map((row) => row.id).sort()).toEqual(['app-wide', 'own']);
    expect(inB.map((row) => row.id).sort()).toEqual(['app-wide', 'other', 'via-session']);
  });

  it('buckets counts by severity, kind, session, action, read and workspace', async () => {
    const db = await seed({});
    await insertNotification(
      db,
      buildNotification({ id: 'e1', workspaceId: WS_A, action: { kind: 'retry-update' } }),
    );
    await insertNotification(db, buildNotification({ id: 'e2', workspaceId: WS_A }));
    await insertNotification(
      db,
      buildNotification({ id: 'p1', kind: 'pr-created', severity: 'info', sessionId: SESSION_B }),
    );

    const buckets = await countNotifications({ db, workspaceId: WS_A });

    expect(buckets).toHaveLength(3);
    expect(buckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'error', hasAction: true, inWorkspace: true, count: 1 }),
        expect.objectContaining({ kind: 'error', hasAction: false, inWorkspace: true, count: 1 }),
        expect.objectContaining({
          kind: 'pr-created',
          severity: 'info',
          hasSession: true,
          inWorkspace: false,
          count: 1,
        }),
      ]),
    );
  });

  it('marks read and clears only inside the workspace scope', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'own', workspaceId: WS_A }));
    await insertNotification(db, buildNotification({ id: 'other', workspaceId: WS_B }));

    await markAllNotificationsRead({ db, workspaceId: WS_A });
    const afterRead = await listNotifications({ db, workspaceId: null });
    await clearAllNotifications({ db, workspaceId: WS_A });
    const afterClear = await listNotifications({ db, workspaceId: null });

    expect(afterRead.find((row) => row.id === 'own')?.read).toBe(true);
    expect(afterRead.find((row) => row.id === 'other')?.read).toBe(false);
    expect(afterClear.map((row) => row.id)).toEqual(['other']);
  });

  it('counts zero on an empty table', async () => {
    const db = await seed({});

    expect(await countNotifications({ db, workspaceId: null })).toEqual([]);
  });
});
