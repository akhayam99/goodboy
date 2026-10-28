// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { seedDemoStorage } from '../../scenes/demo/demoStorageSeed';
import { installStorageActions } from './installStorageActions';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
  seedDemoStorage();
  installStorageActions({ store });
});

afterEach(() => {
  vi.useRealTimers();
});

const safePaths = () =>
  store
    .getState()
    .storageFolders.filter((folder) => folder.origin === 'archived')
    .map((folder) => folder.path);

describe('the storage cleanup', () => {
  it('lists three older archived folders and the active task folder in use', () => {
    const folders = store.getState().storageFolders;
    expect(safePaths()).toHaveLength(3);
    const inUse = folders.filter((folder) => folder.origin === 'in-use');
    expect(inUse).toHaveLength(1);
    expect(inUse[0]?.branch).toBe('hl/fix-duplicate-credit');
    expect(folders.every((folder) => folder.facts?.verdict === 'safe')).toBe(true);
  });

  it('removes the three archived folders, keeps the active one and names the space freed', async () => {
    const pending = store.getState().removeStorageFolders({ paths: safePaths(), mode: 'safe' });
    vi.advanceTimersByTime(1000);
    const summary = await pending;
    expect(summary.removed).toBe(3);
    expect(summary.freedBytes).toBeGreaterThan(0);
    expect(store.getState().storageOutcome?.removed).toBe(3);
    const left = store.getState().storageFolders;
    expect(left.map((folder) => folder.origin)).toEqual(['in-use']);
    expect(left[0]?.branch).toBe('hl/fix-duplicate-credit');
  });
});
