const dbStubs = vi.hoisted(() => ({
  countNotifications: vi.fn(),
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
import type { NotificationCountBucket } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const bucket = (count: number): NotificationCountBucket => ({
  severity: 'info',
  kind: 'pr-created',
  hasSession: false,
  hasAction: false,
  read: false,
  inWorkspace: true,
  count,
});

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dbStubs.countNotifications.mockReset();
  useAppStore.setState({ currentWorkspaceId: 'ws-a' as WorkspaceId, notificationCounts: [] });
});

describe('notification counts after a change', () => {
  it('drops counts that resolve after the workspace changed', async () => {
    const pending = deferred<ReadonlyArray<NotificationCountBucket>>();
    dbStubs.countNotifications.mockReturnValueOnce(pending.promise);

    const marking = useAppStore.getState().markNotificationsRead();
    await vi.waitFor(() => expect(dbStubs.countNotifications).toHaveBeenCalledTimes(1));
    useAppStore.setState({ currentWorkspaceId: 'ws-b' as WorkspaceId });
    pending.resolve([bucket(3)]);
    await marking;

    expect(useAppStore.getState().notificationCounts).toEqual([]);
  });

  it('stores counts for the workspace it asked about', async () => {
    dbStubs.countNotifications.mockResolvedValueOnce([bucket(2)]);

    await useAppStore.getState().markNotificationsRead();

    expect(useAppStore.getState().notificationCounts).toEqual([bucket(2)]);
  });

  it('keeps only the answer of the latest request when two overlap', async () => {
    const first = deferred<ReadonlyArray<NotificationCountBucket>>();
    dbStubs.countNotifications
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([bucket(1)]);

    const earlier = useAppStore.getState().markNotificationsRead();
    await vi.waitFor(() => expect(dbStubs.countNotifications).toHaveBeenCalledTimes(1));
    await useAppStore.getState().markNotificationsRead();
    first.resolve([bucket(9)]);
    await earlier;

    expect(useAppStore.getState().notificationCounts).toEqual([bucket(1)]);
  });
});
