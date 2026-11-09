// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { nextSessionId } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../store/storyHarness';
import type { BrowserTab } from '../../store/slices/browser/types';
import { createNativePlacement } from './createNativePlacement';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

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
const PANE_BOUNDS = { x: 720, y: 96, width: 480, height: 720 };
const PAGE_BOUNDS = { x: 320, y: 96, width: 880, height: 720 };

type CommandParams = {
  readonly command: string;
};

let store: StoryStore;

const namesOf = ({ command }: CommandParams): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === command)
    .map(([, payload]) => payload);

const quiet = () => undefined;

const settle = async () => {
  for (let tick = 0; tick < 50; tick += 1) {
    await Promise.resolve();
  }
};

const failHideOnce = () => {
  const handler = storySpies.tauriInvoke.getMockImplementation();
  let hasFailed = false;
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    if (name === 'browser_tab_hide' && !hasFailed) {
      hasFailed = true;
      throw { kind: 'refused', message: 'host-busy' };
    }
    return handler?.(name, args);
  });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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

describe('one native view, two places', () => {
  it('lets the page take a view the pane showed, and the covered pane never hides it', async () => {
    const pane = createNativePlacement({ sessionId: SESSION_ID, onError: quiet });
    const page = createNativePlacement({ sessionId: SESSION_ID, onError: quiet });

    pane.want({ view: { tab: TAB, bounds: PANE_BOUNDS } });
    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(1));
    page.want({ view: { tab: TAB, bounds: PAGE_BOUNDS } });
    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(2));

    pane.want({ view: null });
    await settle();

    expect(namesOf({ command: 'browser_tab_hide' })).toEqual([]);
    expect(namesOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      args: { tabId: 'live-1', bounds: PAGE_BOUNDS },
    });

    page.stop();
    await waitFor(() =>
      expect(namesOf({ command: 'browser_tab_hide' })).toEqual([{ args: { tabId: 'live-1' } }]),
    );
  });

  it('shows the view in the pane again once the page lets it go', async () => {
    const pane = createNativePlacement({ sessionId: SESSION_ID, onError: quiet });
    const page = createNativePlacement({ sessionId: SESSION_ID, onError: quiet });
    page.want({ view: { tab: TAB, bounds: PAGE_BOUNDS } });
    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(1));

    page.stop();
    pane.want({ view: { tab: TAB, bounds: PANE_BOUNDS } });

    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(2));
    expect(namesOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      args: { tabId: 'live-1', bounds: PANE_BOUNDS },
    });
    pane.stop();
  });

  it('keeps the page view shown when the pane retries a hide that failed before the page took it', async () => {
    const pane = createNativePlacement({ sessionId: SESSION_ID, onError: quiet });
    const page = createNativePlacement({ sessionId: SESSION_ID, onError: quiet });
    pane.want({ view: { tab: TAB, bounds: PANE_BOUNDS } });
    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(1));

    failHideOnce();
    pane.want({ view: null });
    await waitFor(() => expect(namesOf({ command: 'browser_tab_hide' })).toHaveLength(1));
    page.want({ view: { tab: TAB, bounds: PAGE_BOUNDS } });
    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(2));

    pane.want({ view: null });
    await settle();

    expect(namesOf({ command: 'browser_tab_hide' })).toHaveLength(1);
    expect(namesOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      args: { tabId: 'live-1', bounds: PAGE_BOUNDS },
    });
    page.stop();
    await waitFor(() => expect(namesOf({ command: 'browser_tab_hide' })).toHaveLength(2));
  });

  it('lets a pane that still holds the view yield to the page, then take it back', async () => {
    const pane = createNativePlacement({ sessionId: SESSION_ID, onError: quiet });
    const page = createNativePlacement({ sessionId: SESSION_ID, onError: quiet });
    pane.want({ view: { tab: TAB, bounds: PANE_BOUNDS } });
    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(1));
    page.want({ view: { tab: TAB, bounds: PAGE_BOUNDS } });
    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(2));

    pane.want({ view: { tab: TAB, bounds: { ...PANE_BOUNDS, width: 500 } } });
    await settle();

    expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(2);
    expect(namesOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      args: { tabId: 'live-1', bounds: PAGE_BOUNDS },
    });

    page.stop();
    await waitFor(() => expect(namesOf({ command: 'browser_tab_hide' })).toHaveLength(1));
    pane.want({ view: { tab: TAB, bounds: PANE_BOUNDS } });

    await waitFor(() => expect(namesOf({ command: 'browser_tab_show' })).toHaveLength(3));
    expect(namesOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      args: { tabId: 'live-1', bounds: PANE_BOUNDS },
    });
    pane.stop();
  });
});
