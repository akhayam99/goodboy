// @vitest-environment happy-dom

type KeyHandler = (event: { readonly payload: unknown }) => void;

type KeyBridge = {
  handlers: Array<KeyHandler>;
};

const bridge = vi.hoisted((): KeyBridge => ({ handlers: [] }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    listen: async (event: string, handler: KeyHandler) => {
      if (event === 'browser://page-key') {
        bridge.handlers.push(handler);
      }
      return () => {
        bridge.handlers = bridge.handlers.filter((candidate) => candidate !== handler);
      };
    },
  }),
}));
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { registerShortcut } from '../../../../shared/keyboard/dispatcher';
import { useShortcutOverrides } from '../../../../shared/keyboard/overrides/useShortcutOverrides';
import { SETTING_SHORTCUT_OVERRIDES } from '../../../settings/settings';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { usePageKeys } from './index';

const MAC_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const SESSION_ID = nextSessionId();
const TAB_ID = 'tab-harborline-checkout';

let useAppStore: StoryStore;

type PayloadParams = {
  readonly payload: unknown;
};

type PushArgs = {
  readonly args: { readonly combos: ReadonlyArray<string> };
};

const checkout: BrowserTab = {
  id: TAB_ID,
  sessionId: SESSION_ID,
  projectId: null,
  url: 'http://localhost:5173/checkout',
  title: 'Checkout',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
};

const pushes: Array<ReadonlyArray<string>> = [];

const useWindowKeys = (): void => {
  useShortcutOverrides();
  usePageKeys();
};

const press = ({ payload }: PayloadParams): void => {
  act(() => {
    for (const handler of bridge.handlers) {
      handler({ payload });
    }
  });
};

const listened = async (): Promise<void> => {
  await waitFor(() => expect(bridge.handlers).toHaveLength(1));
};

beforeAll(async () => {
  useAppStore = await importStore();
  Object.defineProperty(navigator, 'userAgent', { value: MAC_AGENT, configurable: true });
  Reflect.set(window, '__TAURI_INTERNALS__', {});
}, STORE_IMPORT_TIMEOUT_MS);

afterAll(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

beforeEach(async () => {
  await resetStoryStore();
  bridge.handlers = [];
  pushes.length = 0;
  stubStoryInvoke({
    browser_page_keys: ({ args }: PushArgs) => {
      pushes.push(args.combos);
      return args.combos.length;
    },
  });
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, [SETTING_SHORTCUT_OVERRIDES]: '{}' },
    browserSessionTabs: { [SESSION_ID]: [checkout] },
  });
});

afterEach(cleanup);

describe('usePageKeys', () => {
  it('hands the host the chords a focused page must give back, and no editing chord', async () => {
    renderHook(() => useWindowKeys());

    await waitFor(() => expect(pushes).toHaveLength(1));
    const combos = pushes[0] ?? [];
    expect(combos).toEqual(
      expect.arrayContaining([
        'cmd+KeyL',
        'cmd+KeyT',
        'cmd+KeyW',
        'cmd+KeyF',
        'cmd+KeyK',
        'cmd+KeyR',
        'cmd+shift+KeyT',
      ]),
    );
    expect(combos).not.toContain('cmd+KeyC');
    expect(combos).not.toContain('cmd+KeyV');
  });

  it('hands the host the new chord once the user rebinds a browser key', async () => {
    const { rerender } = renderHook(() => useWindowKeys());
    await waitFor(() => expect(pushes).toHaveLength(1));

    act(() => {
      useAppStore.setState({
        settings: {
          ...useAppStore.getState().settings,
          [SETTING_SHORTCUT_OVERRIDES]: JSON.stringify({ 'browser.pin': 'cmd+shift+KeyP' }),
        },
      });
    });
    rerender();

    await waitFor(() => expect(pushes).toHaveLength(2));
    const latest = pushes[1] ?? [];
    expect(latest.some((combo) => combo.endsWith('KeyP'))).toBe(true);
    expect(latest).not.toContain('cmd+KeyD');
  });

  it('runs the chord a focused page gave back through the browser scope', async () => {
    const runs: Array<string> = [];
    const stopApp = registerShortcut('app.close', () => {
      runs.push('close pane');
    });
    const stopTab = registerShortcut('browser.closeTab', () => {
      runs.push('close tab');
    });
    renderHook(() => useWindowKeys());
    await listened();

    press({ payload: { tabId: TAB_ID, combo: 'cmd+KeyW' } });

    expect(runs).toEqual(['close tab']);
    stopTab();
    stopApp();
  });

  it('reloads the tab, never the app, on a chord from a page', async () => {
    const runs: Array<string> = [];
    const stopApp = registerShortcut('app.reload', () => {
      runs.push('reload app');
    });
    const stopTab = registerShortcut('browser.reload', () => {
      runs.push('reload tab');
    });
    renderHook(() => useWindowKeys());
    await listened();

    press({ payload: { tabId: TAB_ID, combo: 'cmd+KeyR' } });

    expect(runs).toEqual(['reload tab']);
    stopTab();
    stopApp();
  });

  it('drops a late chord from a tab that is already closed', async () => {
    const runs: Array<string> = [];
    const stop = registerShortcut('browser.closeTab', () => {
      runs.push('close tab');
    });
    renderHook(() => useWindowKeys());
    await listened();
    act(() => {
      useAppStore.setState({ browserSessionTabs: { [SESSION_ID]: [] } });
    });

    press({ payload: { tabId: TAB_ID, combo: 'cmd+KeyW' } });

    expect(runs).toEqual([]);
    stop();
  });

  it('ignores a chord that is not one of the page keys', async () => {
    const runs: Array<string> = [];
    const stop = registerShortcut('session.new', () => {
      runs.push('new session');
    });
    renderHook(() => useWindowKeys());
    await listened();

    press({ payload: { tabId: TAB_ID, combo: 'cmd+KeyN' } });
    press({ payload: { tabId: TAB_ID } });

    expect(runs).toEqual([]);
    stop();
  });

  it('tells the user when the host refuses the chords', async () => {
    stubStoryInvoke({
      browser_page_keys: () => {
        throw { kind: 'failed', message: 'browser-caller' };
      },
    });
    renderHook(() => useWindowKeys());

    await waitFor(() =>
      expect(useAppStore.getState().notifications.map((note) => note.title)).toContain(
        "Goodboy's keys don't work inside a browser page",
      ),
    );
    expect(storySpies.tauriInvoke).toHaveBeenCalledWith('browser_page_keys', expect.anything());
  });
});
