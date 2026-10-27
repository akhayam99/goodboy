// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { bus } = vi.hoisted(() => ({
  bus: {
    handlers: new Set<(change: { readonly kind: 'setting'; readonly key: string }) => void>(),
    announced: new Array<{ readonly kind: 'setting'; readonly key: string }>(),
    failNext: { current: false },
  },
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../shared/lib/dataChanged', () => ({
  announceDataChanged: async ({
    change,
  }: {
    readonly change: { readonly kind: 'setting'; readonly key: string };
  }) => {
    if (bus.failNext.current) {
      bus.failNext.current = false;
      throw new Error('event bus is closed');
    }
    bus.announced.push(change);
    bus.handlers.forEach((handler) => handler(change));
  },
  listenDataChanged: async ({
    onChange,
  }: {
    readonly onChange: (change: { readonly kind: 'setting'; readonly key: string }) => void;
  }) => {
    bus.handlers.add(onChange);
    return () => bus.handlers.delete(onChange);
  },
}));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../store/storyHarness';
import { SETTING_REPO_CHECK_MINUTES } from './settings';
import { listenSettingChanges } from './listenSettingChanges';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  bus.handlers.clear();
  bus.announced.length = 0;
  bus.failNext.current = false;
});

afterEach(() => {
  bus.handlers.clear();
});

describe('a setting saved in another window', () => {
  it('announces the key after the write committed and the store changed', async () => {
    await useAppStore.getState().saveSetting(SETTING_REPO_CHECK_MINUTES, '30');
    expect(useAppStore.getState().settings[SETTING_REPO_CHECK_MINUTES]).toBe('30');
    expect(bus.announced).toEqual([{ kind: 'setting', key: SETTING_REPO_CHECK_MINUTES }]);
  });

  it('keeps the saved value and reports it when the other windows cannot be told', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    bus.failNext.current = true;
    await useAppStore.getState().saveSetting(SETTING_REPO_CHECK_MINUTES, '30');
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(useAppStore.getState().settings[SETTING_REPO_CHECK_MINUTES]).toBe('30');
  });

  it('announces nothing and keeps the old value when the write fails', async () => {
    useAppStore.setState({ settings: { [SETTING_REPO_CHECK_MINUTES]: '5' } });
    storySpies.setSetting.mockRejectedValueOnce(new Error('database is locked'));
    await expect(
      useAppStore.getState().saveSetting(SETTING_REPO_CHECK_MINUTES, '30'),
    ).rejects.toThrow('database is locked');
    expect(useAppStore.getState().settings[SETTING_REPO_CHECK_MINUTES]).toBe('5');
    expect(bus.announced).toEqual([]);
  });

  it('is read again from the database and shown, without a reload of this window', async () => {
    useAppStore.setState({ settings: { [SETTING_REPO_CHECK_MINUTES]: '5' } });
    await listenSettingChanges();
    storySpies.getSetting.mockResolvedValue('30');
    bus.handlers.forEach((handler) =>
      handler({ kind: 'setting', key: SETTING_REPO_CHECK_MINUTES }),
    );
    await vi.waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_REPO_CHECK_MINUTES]).toBe('30'),
    );
    expect(storySpies.getSetting).toHaveBeenCalledWith(
      expect.anything(),
      SETTING_REPO_CHECK_MINUTES,
    );
  });

  it('reports a read that failed and leaves the value this window has', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ settings: { [SETTING_REPO_CHECK_MINUTES]: '5' }, reportError });
    await listenSettingChanges();
    storySpies.getSetting.mockRejectedValueOnce(new Error('database is locked'));
    bus.handlers.forEach((handler) =>
      handler({ kind: 'setting', key: SETTING_REPO_CHECK_MINUTES }),
    );
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(useAppStore.getState().settings[SETTING_REPO_CHECK_MINUTES]).toBe('5');
  });

  it('stops following once the listener is removed', async () => {
    const stop = await listenSettingChanges();
    stop();
    expect(bus.handlers.size).toBe(0);
  });
});
