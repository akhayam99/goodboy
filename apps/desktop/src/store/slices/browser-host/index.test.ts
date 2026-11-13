import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importStore,
  resetStoryStore,
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

const CHECKOUT = 'http://localhost:5173/checkout';
const PRICING = 'http://localhost:5173/pricing';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('the browser host slice', () => {
  it('records a started load by its tab and drops it when the same address finishes', () => {
    const state = useAppStore.getState();
    state.startBrowserLoad({ tabId: 'live-1', url: CHECKOUT, startedAt: 10 });

    expect(useAppStore.getState().browserLoads).toEqual({
      'live-1': { url: CHECKOUT, startedAt: 10 },
    });
    expect(state.finishBrowserLoad({ tabId: 'live-1', url: CHECKOUT })).toBe(true);
    expect(useAppStore.getState().browserLoads).toEqual({});
  });

  it('keeps a load running when a finished event names another address', () => {
    const state = useAppStore.getState();
    state.startBrowserLoad({ tabId: 'live-1', url: PRICING, startedAt: 10 });

    expect(state.finishBrowserLoad({ tabId: 'live-1', url: CHECKOUT })).toBe(false);
    expect(useAppStore.getState().browserLoads['live-1']?.url).toBe(PRICING);
  });

  it('ignores a finished event for a tab that was never loading', () => {
    expect(useAppStore.getState().finishBrowserLoad({ tabId: 'live-9', url: CHECKOUT })).toBe(
      false,
    );
    expect(useAppStore.getState().browserLoads).toEqual({});
  });

  it('expires only the load it was scheduled for', () => {
    const state = useAppStore.getState();
    state.startBrowserLoad({ tabId: 'live-1', url: CHECKOUT, startedAt: 10 });
    state.startBrowserLoad({ tabId: 'live-1', url: PRICING, startedAt: 20 });

    expect(state.expireBrowserLoad({ tabId: 'live-1', startedAt: 10 })).toBe(false);
    expect(useAppStore.getState().browserLoads['live-1']?.startedAt).toBe(20);
    expect(state.expireBrowserLoad({ tabId: 'live-1', startedAt: 20 })).toBe(true);
    expect(useAppStore.getState().browserLoads).toEqual({});
  });

  it('keeps the other tabs loading when one is forgotten', () => {
    const state = useAppStore.getState();
    state.startBrowserLoad({ tabId: 'live-1', url: CHECKOUT, startedAt: 10 });
    state.startBrowserLoad({ tabId: 'live-2', url: PRICING, startedAt: 11 });

    state.forgetBrowserLoad({ tabId: 'live-1' });
    state.forgetBrowserLoad({ tabId: 'live-1' });

    expect(Object.keys(useAppStore.getState().browserLoads)).toEqual(['live-2']);
  });

  it('remembers an icon and a miss per origin', () => {
    const state = useAppStore.getState();
    state.setBrowserFavicon({ origin: 'http://localhost:5173', src: 'data:image/png;base64,AAAA' });
    state.setBrowserFavicon({ origin: 'http://localhost:8080', src: null });

    expect(useAppStore.getState().browserFavicons).toEqual({
      'http://localhost:5173': 'data:image/png;base64,AAAA',
      'http://localhost:8080': null,
    });
  });
});
