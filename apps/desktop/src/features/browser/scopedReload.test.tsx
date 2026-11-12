// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../store/storyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import { replayShortcut } from '../../shared/keyboard/replayShortcut';
import { pressShortcut } from '../../__tests__/helpers/pressKey';
import { SessionRefreshBridge } from '../session/components/SessionRefreshBridge';
import type { BrowserTabFacts } from './types';
import { BrowserPane } from './components/BrowserPane';
import { useBrowserWindowShortcuts } from './hooks/useBrowserWindowShortcuts';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const VIEW_RECT = new DOMRect(480, 96, 640, 720);

type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type TabArgs = { readonly args: { readonly tabId: string } };
type SaveArgs = { readonly args: { readonly id: string } };
type CommandParams = { readonly command: string };
type WorldParams = { readonly isBrowserOpen: boolean };

let store: StoryStore;
let live: BrowserTabFacts[];
let windowReloads: number;

const WindowShortcuts = () => {
  useBrowserWindowShortcuts();
  return null;
};

const stubHost = () => {
  stubStoryInvoke({
    browser_tab_rows_list: () => [],
    browser_tab_row_save: ({ args }: SaveArgs) => ({
      ...args,
      sessionId: SESSION_ID,
      projectId: null,
      position: 0,
      createdAt: 1,
      updatedAt: 1,
    }),
    browser_tab_open: ({ args }: OpenArgs) => {
      const facts: BrowserTabFacts = {
        id: `live-${live.length + 1}`,
        sessionId: args.sessionId,
        url: args.url,
        title: '',
        state: 'live',
        isShown: false,
        hiddenSinceMs: null,
        openerId: null,
        isPasskeyBlocked: false,
      };
      live = [...live, facts];
      return facts;
    },
    browser_tab_list: () => live,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_reload: null,
  });
};

const callsOf = ({ command }: CommandParams) =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command);

const isSessionRefreshed = () => store.getState().sessionExternalTasks[SESSION_ID] !== undefined;

const renderWorld = ({ isBrowserOpen }: WorldParams) => {
  store.setState({
    drawer: isBrowserOpen ? { kind: 'browser', sessionId: SESSION_ID, payload: null } : null,
  });
  return render(
    <ToastProvider>
      <WindowShortcuts />
      <SessionRefreshBridge />
      {isBrowserOpen ? <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} /> : null}
    </ToastProvider>,
  );
};

const openPage = async () => {
  const field = screen.getByRole('textbox', { name: 'Address' });
  fireEvent.change(field, { target: { value: 'localhost:5173/checkout' } });
  const form = field.closest('form');
  if (form === null) {
    throw new Error('The address field sits in no form.');
  }
  await act(async () => {
    fireEvent.submit(form);
  });
  const view = await waitFor(() => {
    const found = document.querySelector('[data-browser-view]');
    if (found === null) {
      throw new Error('The pane draws no view placeholder yet.');
    }
    return found;
  });
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => VIEW_RECT,
  });
  Object.defineProperty(view, 'checkVisibility', { configurable: true, value: () => true });
  await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  live = [];
  windowReloads = 0;
  await openStorySqlite();
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
  });
  stubHost();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      reload: () => {
        windowReloads += 1;
      },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('cmd+R reloads where you are', () => {
  it('refreshes the session on screen and never reloads the window', async () => {
    renderWorld({ isBrowserOpen: false });
    expect(isSessionRefreshed()).toBe(false);

    pressShortcut({ id: 'view.reload', target: document.body });

    await waitFor(() => expect(isSessionRefreshed()).toBe(true));
    expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([]);
    expect(windowReloads).toBe(0);
  });

  it('reloads the browser tab when the browser holds the keyboard, not the session', async () => {
    renderWorld({ isBrowserOpen: true });
    await openPage();

    const field = screen.getByRole('textbox', { name: 'Address' });
    field.focus();
    pressShortcut({ id: 'view.reload' });

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_reload' })).toEqual([
        ['browser_tab_reload', { args: { tabId: 'live-1' } }],
      ]),
    );
    expect(isSessionRefreshed()).toBe(false);
    expect(windowReloads).toBe(0);
  });

  it('reloads the tab from the menu while the page webview itself has focus', async () => {
    renderWorld({ isBrowserOpen: true });
    await openPage();
    fireEvent.pointerDown(document.body);
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);

    replayShortcut({ id: 'view.reload' });

    await waitFor(() => expect(callsOf({ command: 'browser_tab_reload' })).toHaveLength(1));
    expect(isSessionRefreshed()).toBe(false);
    expect(windowReloads).toBe(0);
  });

  it('refreshes the session when the browser sits beside it but the session holds the keyboard', async () => {
    renderWorld({ isBrowserOpen: true });
    await openPage();

    fireEvent.pointerDown(document.body);
    pressShortcut({ id: 'view.reload', target: document.body });

    await waitFor(() => expect(isSessionRefreshed()).toBe(true));
    expect(callsOf({ command: 'browser_tab_reload' })).toEqual([]);
  });

  it('does nothing visible on a page with no reload of its own', async () => {
    store.setState({ currentSessionId: null });
    renderWorld({ isBrowserOpen: false });

    pressShortcut({ id: 'view.reload', target: document.body });

    expect(isSessionRefreshed()).toBe(false);
    expect(windowReloads).toBe(0);
  });

  it('reloads Goodboy on its own shortcut', async () => {
    renderWorld({ isBrowserOpen: false });

    pressShortcut({ id: 'app.reload', target: document.body });

    await waitFor(() => expect(windowReloads).toBe(1));
    expect(isSessionRefreshed()).toBe(false);
  });
});
