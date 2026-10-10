import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertNotification, insertWorkspace, type Notification } from '@goodboy/db';
import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

type RowParams = {
  readonly overrides: Partial<Notification>;
};

const row = ({ overrides }: RowParams): Notification => ({
  id: 'n-1',
  ts: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  kind: 'error',
  title: 'Webhook redelivery failed',
  body: 'payments-api returned 502',
  severity: 'error',
  sessionId: null,
  workspaceId: WORKSPACE_ID,
  read: false,
  action: null,
  coalesceKey: 'error:webhook',
  ...overrides,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  await insertNotification(db, row({ overrides: { id: 'n-1' } }));
  await insertNotification(
    db,
    row({ overrides: { id: 'n-2', title: 'Sync stalled', coalesceKey: 'sync' } }),
  );
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID, undoStack: [] });
  await useAppStore.getState().loadNotifications();
});

const storedIds = async () =>
  (await rowsOf<{ id: string }>({ sql: 'SELECT id FROM notifications ORDER BY id' })).map(
    (stored) => stored.id,
  );

describe('undoable notification delete on sqlite', () => {
  it('deletes the row at once and pushes one undo entry', async () => {
    await useAppStore.getState().dismissNotificationGroup({ ids: ['n-1'] });

    expect(await storedIds()).toEqual(['n-2']);
    expect(useAppStore.getState().notifications.map((n) => n.id)).toEqual(['n-2']);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(useAppStore.getState().undoNotices.at(-1)?.toast.message).toBe('Notification deleted');
  });

  it('restores the row with its fields when Undo runs', async () => {
    await useAppStore.getState().dismissNotificationGroup({ ids: ['n-1'] });
    expect(await useAppStore.getState().undoLastOperation({})).toBe(true);

    expect(await storedIds()).toEqual(['n-1', 'n-2']);
    const restored = useAppStore.getState().notifications.find((n) => n.id === 'n-1');
    expect(restored).toMatchObject({
      title: 'Webhook redelivery failed',
      body: 'payments-api returned 502',
      read: false,
      coalesceKey: 'error:webhook',
    });
    expect(useAppStore.getState().undoStack).toHaveLength(0);
  });

  it('undoes a whole group in one step', async () => {
    await useAppStore.getState().dismissNotificationGroup({ ids: ['n-1', 'n-2'] });
    expect(await storedIds()).toEqual([]);
    expect(useAppStore.getState().undoStack).toHaveLength(1);

    await useAppStore.getState().undoLastOperation({});

    expect(await storedIds()).toEqual(['n-1', 'n-2']);
    expect(useAppStore.getState().notificationCounts.reduce((n, b) => n + b.count, 0)).toBe(2);
  });

  it('offers Undo for the rows already deleted when a later delete fails', async () => {
    await storySqlite().exec(
      `CREATE TRIGGER notification_delete_fails BEFORE DELETE ON notifications
       WHEN OLD.id = 'n-2'
       BEGIN SELECT RAISE(ABORT, 'database is locked'); END`,
    );

    await expect(
      useAppStore.getState().dismissNotificationGroup({ ids: ['n-1', 'n-2'] }),
    ).rejects.toThrow('database is locked');

    expect(await storedIds()).toEqual(['n-2']);
    expect(useAppStore.getState().undoStack).toHaveLength(1);
    expect(useAppStore.getState().undoNotices.at(-1)?.toast.message).toBe('Notification deleted');

    await useAppStore.getState().undoLastOperation({});

    expect(await storedIds()).toEqual(['n-1', 'n-2']);
  });

  it('keeps the read flag a row had when it was deleted', async () => {
    await useAppStore.getState().markNotificationRead('n-2');
    await useAppStore.getState().dismissNotificationGroup({ ids: ['n-2'] });
    await useAppStore.getState().undoLastOperation({});

    expect(useAppStore.getState().notifications.find((n) => n.id === 'n-2')?.read).toBe(true);
  });

  it('pushes no undo entry for an id that is not loaded', async () => {
    await useAppStore.getState().dismissNotificationGroup({ ids: ['missing'] });

    expect(useAppStore.getState().undoStack).toHaveLength(0);
  });

  it('returns the removed row from dismissNotification', async () => {
    const removed = await useAppStore.getState().dismissNotification('n-1');

    expect(removed?.id).toBe('n-1');
    expect(await useAppStore.getState().dismissNotification('n-1')).toBeUndefined();
  });

  it('deletes everything in the scope for Delete all and offers no undo', async () => {
    await useAppStore.getState().clearNotifications();

    expect(await storedIds()).toEqual([]);
    expect(useAppStore.getState().undoStack).toHaveLength(0);
  });
});
