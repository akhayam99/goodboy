// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { nextSessionId } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { appliedZoom } from '../../../../shared/lib/appliedZoom';
import { applyStoredZoom, zoomIn, zoomReset } from '../../../../shared/lib/zoom';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { useNativePlacement } from '.';

type ZoomCalls = {
  factors: Array<number>;
  isRefused: boolean;
};

const zoomCalls = vi.hoisted((): ZoomCalls => ({ factors: [], isRefused: false }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    setZoom: async (factor: number) => {
      if (zoomCalls.isRefused) {
        throw new Error('zoom refused');
      }
      zoomCalls.factors.push(factor);
    },
  }),
}));

const SESSION_ID = nextSessionId();
const TAB: BrowserTab = {
  id: 'tab-checkout',
  sessionId: SESSION_ID,
  projectId: null,
  url: 'http://localhost:5173/checkout',
  title: 'Checkout',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
};

type RectParams = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

let store: StoryStore;
let rect: RectParams = { x: 100, y: 50, width: 400, height: 300 };

const mountView = (): HTMLDivElement => {
  const view = document.createElement('div');
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(rect.x, rect.y, rect.width, rect.height),
  });
  Object.defineProperty(view, 'checkVisibility', { configurable: true, value: () => true });
  document.body.append(view);
  return view;
};

const lastPlace = (): unknown =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'browser_tab_place')
    .map(([, payload]) => payload)
    .at(-1);

const renderPlacement = () => {
  const view = mountView();
  return renderHook(() =>
    useNativePlacement({
      sessionId: SESSION_ID,
      frame: { current: view },
      view: { current: view },
      tab: TAB,
      attempt: 0,
      maxWidth: null,
      onError: () => undefined,
    }),
  );
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  rect = { x: 100, y: 50, width: 400, height: 300 };
  zoomCalls.factors = [];
  zoomCalls.isRefused = false;
  appliedZoom.write({ factor: 1 });
  localStorage.removeItem(STORAGE_KEYS.zoom);
  store.setState({
    browserSessionTabs: { [SESSION_ID]: [TAB] },
    browserLiveTabs: { [SESSION_ID]: { [TAB.id]: 'live-1' } },
  });
  stubStoryInvoke({
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
  });
});

afterEach(() => {
  appliedZoom.write({ factor: 1 });
  document.body.replaceChildren();
});

describe('the native page under app zoom', () => {
  it('places the page in window points and moves it again when the zoom changes', async () => {
    const { unmount } = renderPlacement();
    await waitFor(() =>
      expect(lastPlace()).toEqual({
        args: { tabId: 'live-1', bounds: { x: 100, y: 50, width: 400, height: 300 } },
      }),
    );

    await zoomIn();

    await waitFor(() =>
      expect(lastPlace()).toEqual({
        args: { tabId: 'live-1', bounds: { x: 110, y: 55, width: 440, height: 330 } },
      }),
    );
    expect(zoomCalls.factors).toEqual([1.1]);
    unmount();
  });

  it('places the page at the stored zoom after a reload', async () => {
    localStorage.setItem(STORAGE_KEYS.zoom, '1.5');
    const { unmount } = renderPlacement();

    await applyStoredZoom();

    await waitFor(() =>
      expect(lastPlace()).toEqual({
        args: { tabId: 'live-1', bounds: { x: 150, y: 75, width: 600, height: 450 } },
      }),
    );
    unmount();
  });

  it('follows a dock or window resize at the current zoom', async () => {
    appliedZoom.write({ factor: 1.25 });
    const { unmount } = renderPlacement();
    await waitFor(() =>
      expect(lastPlace()).toEqual({
        args: { tabId: 'live-1', bounds: { x: 125, y: 63, width: 500, height: 375 } },
      }),
    );

    rect = { x: 60, y: 50, width: 440, height: 300 };

    await waitFor(() =>
      expect(lastPlace()).toEqual({
        args: { tabId: 'live-1', bounds: { x: 75, y: 63, width: 550, height: 375 } },
      }),
    );
    unmount();
  });

  it('keeps the old placement when the zoom is refused', async () => {
    appliedZoom.write({ factor: 1.5 });
    const { unmount } = renderPlacement();
    await waitFor(() =>
      expect(lastPlace()).toEqual({
        args: { tabId: 'live-1', bounds: { x: 150, y: 75, width: 600, height: 450 } },
      }),
    );
    zoomCalls.isRefused = true;

    await zoomReset();

    expect(appliedZoom.read()).toBe(1.5);
    expect(lastPlace()).toEqual({
      args: { tabId: 'live-1', bounds: { x: 150, y: 75, width: 600, height: 450 } },
    });
    unmount();
  });
});
