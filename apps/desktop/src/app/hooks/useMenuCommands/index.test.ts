// @vitest-environment happy-dom

type MenuHandler = (event: { readonly payload: unknown }) => void;

type MenuBridge = {
  handlers: Array<MenuHandler>;
  stops: number;
  release: null | (() => void);
  isHeld: boolean;
};

const menu = vi.hoisted((): MenuBridge => ({
  handlers: [],
  stops: 0,
  release: null,
  isHeld: false,
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    listen: async (event: string, handler: MenuHandler) => {
      if (menu.isHeld) {
        await new Promise<void>((resolve) => {
          menu.release = resolve;
        });
      }
      if (event === 'goodboy://menu') {
        menu.handlers.push(handler);
      }
      return () => {
        menu.stops += 1;
        menu.handlers = menu.handlers.filter((candidate) => candidate !== handler);
      };
    },
  }),
}));
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { registerShortcut } from '../../../shared/keyboard/dispatcher';
import { useMenuCommands } from './index';

const MAC_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

let useAppStore: StoryStore;

type PickParams = {
  readonly payload: unknown;
};

type EventsParams = {
  readonly name: string;
};

const pick = ({ payload }: PickParams): void => {
  act(() => {
    for (const handler of menu.handlers) {
      handler({ payload });
    }
  });
};

const listened = async (): Promise<void> => {
  await waitFor(() => expect(menu.handlers).toHaveLength(1));
};

const detailsOf = ({ name }: EventsParams): Array<unknown> => {
  const seen: Array<unknown> = [];
  window.addEventListener(name, (event) => {
    seen.push(event instanceof CustomEvent ? event.detail : undefined);
  });
  return seen;
};

beforeAll(async () => {
  useAppStore = await importStore();
  Object.defineProperty(navigator, 'userAgent', { value: MAC_AGENT, configurable: true });
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  menu.handlers = [];
  menu.stops = 0;
  menu.release = null;
  menu.isHeld = false;
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    currentSessionId: null,
    appStudio: null,
  });
});

afterEach(cleanup);

describe('useMenuCommands', () => {
  it('runs the shortcut a menu item names exactly once, through the dispatcher', async () => {
    const runs: Array<string> = [];
    const stop = registerShortcut('settings.open', () => {
      runs.push('settings');
    });
    renderHook(() => useMenuCommands());
    await listened();

    pick({ payload: { id: 'settings.open' } });

    expect(runs).toEqual(['settings']);
    stop();
  });

  it('lets the scoped owner of a key take the menu item, as the key would', async () => {
    const runs: Array<string> = [];
    const stopGlobal = registerShortcut('app.close', () => {
      runs.push('close');
    });
    const stopScoped = registerShortcut('terminal.closeTab', () => {
      runs.push('close tab');
    });
    renderHook(() => useMenuCommands());
    await listened();

    pick({ payload: { id: 'app.close' } });

    expect(runs).toEqual(['close tab']);
    stopScoped();
    stopGlobal();
  });

  it('hands a key back to the global owner when the scoped one declines', async () => {
    const runs: Array<string> = [];
    const stopGlobal = registerShortcut('app.close', () => {
      runs.push('close');
    });
    const stopScoped = registerShortcut('terminal.closeTab', () => false, { canDecline: true });
    renderHook(() => useMenuCommands());
    await listened();

    pick({ payload: { id: 'app.close' } });

    expect(runs).toEqual(['close']);
    stopScoped();
    stopGlobal();
  });

  it('runs a menu item that has no key from the menu action table', async () => {
    const guides = detailsOf({ name: 'goodboy:open-guide' });
    renderHook(() => useMenuCommands());
    await listened();

    pick({ payload: { id: 'menu.guide' } });

    expect(guides).toHaveLength(1);
  });

  it('opens a place only when a workspace is open', async () => {
    const inbox = detailsOf({ name: 'goodboy:open-inbox' });
    renderHook(() => useMenuCommands());
    await listened();

    pick({ payload: { id: 'menu.tasks' } });
    useAppStore.setState({ currentWorkspaceId: null });
    pick({ payload: { id: 'menu.tasks' } });

    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toEqual({ door: true });
  });

  it('opens Monitoring as a studio of the current window', async () => {
    renderHook(() => useMenuCommands());
    await listened();

    pick({ payload: { id: 'menu.monitoring' } });

    expect(useAppStore.getState().appStudio?.kind).toBe('monitoring');
  });

  it('checks for updates once and opens where the result shows', async () => {
    const check = vi.fn(async () => undefined);
    useAppStore.setState({ updaterStatus: 'idle', checkForUpdates: check });
    const settings = detailsOf({ name: 'goodboy:open-settings' });
    renderHook(() => useMenuCommands());
    await listened();

    pick({ payload: { id: 'menu.checkForUpdates' } });
    useAppStore.setState({ updaterStatus: 'checking' });
    pick({ payload: { id: 'menu.checkForUpdates' } });

    expect(check).toHaveBeenCalledTimes(1);
    expect(settings).toHaveLength(2);
    expect(settings[0]).toEqual({
      scope: 'app',
      section: 'general',
      door: true,
    });
  });

  it('ignores an unknown or malformed id and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderHook(() => useMenuCommands());
    await listened();

    pick({ payload: { id: 'menu.retired' } });
    pick({ payload: { id: 'menu.retired' } });
    pick({ payload: { item: 'settings.open' } });
    pick({ payload: null });

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[0]).toContain('menu.retired');
    warn.mockRestore();
  });

  it('stops listening on unmount', async () => {
    const view = renderHook(() => useMenuCommands());
    await listened();

    view.unmount();

    expect(menu.stops).toBe(1);
    expect(menu.handlers).toEqual([]);
  });

  it('drops a listener that arrives after the unmount', async () => {
    menu.isHeld = true;
    const view = renderHook(() => useMenuCommands());
    await waitFor(() => expect(menu.release).not.toBeNull());

    view.unmount();
    menu.release?.();

    await waitFor(() => expect(menu.stops).toBe(1));
    expect(menu.handlers).toEqual([]);
  });
});
