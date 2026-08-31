import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrations } from '../migrations';
import { migrate } from '../migrations/runner';
import {
  NOTIFICATION_LIST_LIMIT,
  countNotifications,
  deleteNotification,
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from './notification';

type SeedParams = Record<string, never>;

const seed = async ({}: SeedParams) => {
  const db = makeTestDatabase();
  await migrate(db, migrations);
  return db;
};

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

    const rows = await listNotifications(db);

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

    const rows = await listNotifications(db);
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

    const rows = await listNotifications(db);
    expect(rows.map((row) => row.id)).toEqual(['n1']);
  });

  it('marks every unread notification read', async () => {
    const db = await seed({});
    await insertNotification(db, buildNotification({ id: 'n1' }));
    await insertNotification(
      db,
      buildNotification({ id: 'n2', ts: '2026-08-04T11:00:00.000Z' as IsoDateTime }),
    );

    await markAllNotificationsRead(db);

    const rows = await listNotifications(db);
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

    const rows = await listNotifications(db);

    expect(rows).toHaveLength(NOTIFICATION_LIST_LIMIT);
    expect(rows[0]?.id).toBe(`n${total - 1}`);
  });

  it('counts every row, including unread ones the list cap cuts off', async () => {
    const db = await seed({});
    const total = NOTIFICATION_LIST_LIMIT + 5;
    for (let index = 0; index < total; index += 1) {
      await insertNotification(
        db,
        buildNotification({
          id: `n${index}`,
          ts: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString() as IsoDateTime,
          read: index !== 0,
        }),
      );
    }

    const listed = await listNotifications(db);
    const counts = await countNotifications(db);

    expect(listed.some((row) => row.id === 'n0')).toBe(false);
    expect(counts).toEqual({ total, unread: 1 });
  });

  it('counts zero on an empty table', async () => {
    const db = await seed({});

    expect(await countNotifications(db)).toEqual({ total: 0, unread: 0 });
  });
});
