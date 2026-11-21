import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertNotification, insertWorkspace, type Notification } from '@goodboy/db';
import { brandId, type IsoDateTime, type WorkspaceId } from '@goodboy/types';
import {
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
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

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'workspace-northwind' });

type RowParams = {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
};

const rowOf = ({ id, workspaceId }: RowParams): Notification => ({
  id,
  ts: brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' }),
  kind: 'error',
  title: '1 comment needs you',
  body: 'A fix run is waiting for your answer.',
  severity: 'warning',
  sessionId: null,
  workspaceId,
  read: false,
  action: null,
  coalesceKey: `error:${id}`,
  actedAt: null,
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
    workspace: buildStoryWorkspace({ id: HARBORLINE, name: 'Harborline', slug: 'harborline' }),
  });
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: NORTHWIND, name: 'Northwind', slug: 'northwind' }),
  });
  await insertNotification(db, rowOf({ id: 'n-harborline', workspaceId: HARBORLINE }));
  await insertNotification(db, rowOf({ id: 'n-northwind', workspaceId: NORTHWIND }));
  useAppStore.setState({ currentWorkspaceId: HARBORLINE });
});

const unreadIds = async () =>
  (
    await rowsOf<{ id: string }>({
      sql: 'SELECT id FROM notifications WHERE read = 0 ORDER BY id',
      params: [],
    })
  ).map((row) => row.id);

const unreadCountSeenFrom = async ({ workspaceId }: { readonly workspaceId: WorkspaceId }) => {
  useAppStore.setState({ currentWorkspaceId: workspaceId, notificationScope: 'all' });
  await useAppStore.getState().loadNotifications();
  return useAppStore.getState().notifications.filter((notification) => !notification.read).length;
};

describe('Mark all as read on sqlite', () => {
  it('marks only this workspace when you look at this workspace', async () => {
    useAppStore.setState({ notificationScope: 'workspace' });
    await useAppStore.getState().loadNotifications();

    await useAppStore.getState().markNotificationsRead();

    expect(await unreadIds()).toEqual(['n-northwind']);
    expect(useAppStore.getState().notifications.every((notification) => notification.read)).toBe(
      true,
    );
    expect(await unreadCountSeenFrom({ workspaceId: NORTHWIND })).toBe(1);
  });

  it('marks every workspace when you look at all of them, and the other window sees it on load', async () => {
    useAppStore.setState({ notificationScope: 'all' });
    await useAppStore.getState().loadNotifications();

    await useAppStore.getState().markNotificationsRead();

    expect(await unreadIds()).toEqual([]);
    expect(await unreadCountSeenFrom({ workspaceId: NORTHWIND })).toBe(0);
  });

  it('leaves the list alone when the scope changed while it was writing', async () => {
    useAppStore.setState({ notificationScope: 'workspace' });
    await useAppStore.getState().loadNotifications();

    const pending = useAppStore.getState().markNotificationsRead();
    useAppStore.setState({ notificationScope: 'all' });
    await pending;

    expect(await unreadIds()).toEqual(['n-northwind']);
    expect(useAppStore.getState().notificationScope).toBe('all');
    expect(useAppStore.getState().notifications.some((notification) => !notification.read)).toBe(
      true,
    );
  });
});
