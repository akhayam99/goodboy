// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

const { relaunchSpy } = vi.hoisted(() => ({ relaunchSpy: vi.fn(async () => undefined) }));

vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: relaunchSpy, exit: vi.fn() }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  relaunchSpy.mockClear();
  storySpies.tauriInvoke.mockReset();
});

const invokedCommands = (): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls.map((call) => call[0]);

describe('a database that did not open', () => {
  it('retry checks that the file opens and only then relaunches', async () => {
    storySpies.tauriInvoke.mockResolvedValue(null);

    await useAppStore.getState().retryDatabaseOpen();

    expect(invokedCommands()).toEqual(['db_check_openable']);
    expect(relaunchSpy).toHaveBeenCalledOnce();
  });

  it('retry that still cannot open keeps the screen and does not relaunch', async () => {
    storySpies.tauriInvoke.mockRejectedValue({
      kind: 'sqlite',
      message: 'sqlite error: file is not a database',
    });

    await expect(useAppStore.getState().retryDatabaseOpen()).rejects.toThrow(
      'file is not a database',
    );

    expect(relaunchSpy).not.toHaveBeenCalled();
  });

  it('move aside keeps the copy through the backend and then relaunches', async () => {
    storySpies.tauriInvoke.mockResolvedValue('/Users/dev/.goodboy/data.db.unopened-42');

    await useAppStore.getState().moveDatabaseAside();

    expect(invokedCommands()).toEqual(['db_move_aside']);
    expect(relaunchSpy).toHaveBeenCalledOnce();
  });

  it('move aside that fails leaves the file where it is and does not relaunch', async () => {
    storySpies.tauriInvoke.mockRejectedValue({
      kind: 'migration_snapshot_filesystem',
      message: 'permission denied',
    });

    await expect(useAppStore.getState().moveDatabaseAside()).rejects.toThrow('permission denied');

    expect(relaunchSpy).not.toHaveBeenCalled();
  });
});
