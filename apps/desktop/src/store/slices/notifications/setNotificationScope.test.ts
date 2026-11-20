const dbStubs = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  countNotifications: vi.fn(),
  clearResolvedHelperNotifications: vi.fn(),
  insertNotification: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock(dbStubs));
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification, NotificationCountBucket } from '@goodboy/db';
import { brandId, type IsoDateTime, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

type RowParams = {
  readonly id: string;
};

const row = ({ id }: RowParams): Notification => ({
  id,
  ts: brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' }),
  kind: 'pr-created',
  title: id,
  body: null,
  severity: 'info',
  sessionId: null,
  workspaceId: null,
  read: true,
  action: null,
  coalesceKey: id,
  actedAt: null,
});

const BUCKET: NotificationCountBucket = {
  severity: 'info',
  kind: 'pr-created',
  hasSession: false,
  hasAction: false,
  actionKind: null,
  isActed: false,
  read: false,
  inWorkspace: true,
  count: 4,
};

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const WORKSPACE_ROWS = [row({ id: 'workspace-row' })];
const ALL_ROWS = [row({ id: 'all-row' }), row({ id: 'other-workspace-row' })];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dbStubs.listNotifications.mockReset();
  dbStubs.countNotifications.mockReset().mockResolvedValue([BUCKET]);
  dbStubs.clearResolvedHelperNotifications.mockReset().mockResolvedValue(undefined);
  dbStubs.insertNotification.mockReset().mockResolvedValue(undefined);
  useAppStore.setState({
    currentWorkspaceId: brandId<WorkspaceId>({ value: 'ws-harborline' }),
    notificationScope: 'workspace',
    notifications: WORKSPACE_ROWS,
    notificationCounts: [BUCKET],
    notificationsLoading: false,
  });
});

const errorRows = (): ReadonlyArray<Notification> =>
  useAppStore.getState().notifications.filter((notification) => notification.kind === 'error');

describe('switching which workspaces the bell lists', () => {
  it('keeps the old list on screen until the new one is read', async () => {
    const pending = deferred<ReadonlyArray<Notification>>();
    dbStubs.listNotifications.mockReturnValueOnce(pending.promise);

    const switching = useAppStore.getState().setNotificationScope('all');
    await vi.waitFor(() => expect(dbStubs.listNotifications).toHaveBeenCalledTimes(1));

    expect(useAppStore.getState().notificationScope).toBe('workspace');
    expect(useAppStore.getState().notifications).toBe(WORKSPACE_ROWS);
    expect(useAppStore.getState().notificationsLoading).toBe(true);

    pending.resolve(ALL_ROWS);
    await switching;

    expect(useAppStore.getState().notificationScope).toBe('all');
    expect(useAppStore.getState().notifications).toEqual(ALL_ROWS);
    expect(dbStubs.listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: null }),
    );
  });

  it('keeps scope, list and counts when the read fails, and logs it with Retry', async () => {
    dbStubs.listNotifications.mockRejectedValueOnce(new Error('database is locked'));
    dbStubs.countNotifications.mockResolvedValueOnce([]);

    await useAppStore.getState().setNotificationScope('all');

    const state = useAppStore.getState();
    expect(state.notificationScope).toBe('workspace');
    expect(state.notifications.filter((notification) => notification.kind !== 'error')).toEqual(
      WORKSPACE_ROWS,
    );
    expect(state.notificationCounts).toEqual([BUCKET]);
    expect(state.notificationsLoading).toBe(false);
    expect(errorRows()).toEqual([
      expect.objectContaining({
        title: "Couldn't load notifications",
        action: { kind: 'retry-notification-scope', scope: 'all' },
      }),
    ]);
  });

  it('keeps the last switch when an earlier one fails after it', async () => {
    const earlier = deferred<ReadonlyArray<Notification>>();
    dbStubs.listNotifications
      .mockReturnValueOnce(earlier.promise)
      .mockResolvedValueOnce(WORKSPACE_ROWS);

    const first = useAppStore.getState().setNotificationScope('all');
    await vi.waitFor(() => expect(dbStubs.listNotifications).toHaveBeenCalledTimes(1));
    await useAppStore.getState().setNotificationScope('workspace');
    earlier.reject(new Error('database is locked'));
    await first;

    expect(useAppStore.getState().notificationScope).toBe('workspace');
    expect(useAppStore.getState().notifications).toEqual(WORKSPACE_ROWS);
    expect(errorRows()).toEqual([]);
  });

  it('drops an earlier switch that answers after the last one', async () => {
    const earlier = deferred<ReadonlyArray<Notification>>();
    dbStubs.listNotifications
      .mockReturnValueOnce(earlier.promise)
      .mockResolvedValueOnce(WORKSPACE_ROWS);

    const first = useAppStore.getState().setNotificationScope('all');
    await vi.waitFor(() => expect(dbStubs.listNotifications).toHaveBeenCalledTimes(1));
    await useAppStore.getState().setNotificationScope('workspace');
    earlier.resolve(ALL_ROWS);
    await first;

    expect(useAppStore.getState().notificationScope).toBe('workspace');
    expect(useAppStore.getState().notifications).toEqual(WORKSPACE_ROWS);
  });
});

describe('retrying a failed switch', () => {
  it('switches once the read works again', async () => {
    dbStubs.listNotifications
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValueOnce(ALL_ROWS);

    await useAppStore.getState().setNotificationScope('all');
    await useAppStore.getState().setNotificationScope('all');

    expect(useAppStore.getState().notificationScope).toBe('all');
    expect(useAppStore.getState().notifications).toEqual(ALL_ROWS);
  });

  it('reads nothing when the scope already changed since the failure', async () => {
    dbStubs.listNotifications.mockRejectedValueOnce(new Error('database is locked'));
    await useAppStore.getState().setNotificationScope('all');
    useAppStore.setState({ notificationScope: 'all', notifications: ALL_ROWS });
    dbStubs.listNotifications.mockClear();

    await useAppStore.getState().setNotificationScope('all');

    expect(dbStubs.listNotifications).not.toHaveBeenCalled();
    expect(useAppStore.getState().notifications).toEqual(ALL_ROWS);
  });

  it('keeps the old list when the helper cleanup worked and the list read failed', async () => {
    dbStubs.listNotifications.mockRejectedValueOnce(new Error('database is locked'));

    await useAppStore.getState().setNotificationScope('all');

    expect(dbStubs.clearResolvedHelperNotifications).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().notificationScope).toBe('workspace');
    expect(useAppStore.getState().notificationCounts).toEqual([BUCKET]);
  });
});
