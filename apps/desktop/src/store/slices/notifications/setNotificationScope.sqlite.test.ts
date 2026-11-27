import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertNotification, insertWorkspace, type Notification } from '@goodboy/db';
import { brandId, type IsoDateTime, type WorkspaceId } from '@goodboy/types';
import {
  buildStoryWorkspace,
  importStore,
  injectDbFault,
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

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SCOPE_FAILURE_KEY = 'notification-scope:all';
const LIST_READ = /^SELECT \* FROM notifications WHERE/;

const WEBHOOK_ROW: Notification = {
  id: 'n-1',
  ts: brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' }),
  kind: 'error',
  title: 'Webhook redelivery failed',
  body: 'payments-api returned 502',
  severity: 'error',
  sessionId: null,
  workspaceId: WORKSPACE_ID,
  read: false,
  action: null,
  coalesceKey: 'error:webhook',
  actedAt: null,
};

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
  await insertNotification(db, WEBHOOK_ROW);
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID, notificationScope: 'workspace' });
  await useAppStore.getState().loadNotifications();
});

const storedScopeFailures = async () =>
  rowsOf<{ id: string }>({
    sql: 'SELECT id FROM notifications WHERE coalesce_key = ?',
    params: [SCOPE_FAILURE_KEY],
  });

const shownScopeFailures = () =>
  useAppStore
    .getState()
    .notifications.filter((notification) => notification.coalesceKey === SCOPE_FAILURE_KEY);

describe('a failed scope switch on sqlite', () => {
  it('stores the failure with Retry, and a working Retry switches and removes it', async () => {
    injectDbFault({ match: LIST_READ });
    await useAppStore.getState().setNotificationScope('all');

    expect(useAppStore.getState().notificationScope).toBe('workspace');
    expect(await storedScopeFailures()).toHaveLength(1);
    expect(shownScopeFailures()).toEqual([
      expect.objectContaining({ action: { kind: 'retry-notification-scope', scope: 'all' } }),
    ]);

    await useAppStore.getState().setNotificationScope('all');

    expect(useAppStore.getState().notificationScope).toBe('all');
    expect(await storedScopeFailures()).toEqual([]);
    expect(shownScopeFailures()).toEqual([]);
    expect(useAppStore.getState().notifications.map((notification) => notification.id)).toEqual([
      'n-1',
    ]);
  });

  it('keeps the failure while Retry fails again', async () => {
    injectDbFault({ match: LIST_READ });
    await useAppStore.getState().setNotificationScope('all');
    injectDbFault({ match: LIST_READ });

    await useAppStore.getState().setNotificationScope('all');

    expect(useAppStore.getState().notificationScope).toBe('workspace');
    expect(await storedScopeFailures()).toHaveLength(1);
    expect(shownScopeFailures()).toHaveLength(1);
  });

  it('removes the failure when the same scope is picked from the tabs', async () => {
    injectDbFault({ match: LIST_READ });
    await useAppStore.getState().setNotificationScope('all');
    await useAppStore.getState().setNotificationScope('workspace');
    expect(await storedScopeFailures()).toHaveLength(1);

    await useAppStore.getState().setNotificationScope('all');

    expect(await storedScopeFailures()).toEqual([]);
    expect(shownScopeFailures()).toEqual([]);
  });

  it('removes a failure left over once its scope is already shown', async () => {
    injectDbFault({ match: LIST_READ });
    await useAppStore.getState().setNotificationScope('all');
    useAppStore.setState({ notificationScope: 'all' });
    await useAppStore.getState().loadNotifications();
    expect(shownScopeFailures()).not.toEqual([]);

    await useAppStore.getState().setNotificationScope('all');

    expect(await storedScopeFailures()).toEqual([]);
    expect(shownScopeFailures()).toEqual([]);
  });
});
