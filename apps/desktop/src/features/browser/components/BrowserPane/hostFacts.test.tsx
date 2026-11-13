// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { listen, type EventCallback } from '@tauri-apps/api/event';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { LOAD_STALL_MS } from '../../hooks/useTabLoad';
import type { BrowserHistoryState, BrowserTabFacts, BrowserTabFavicon } from '../../types';
import { BrowserPane } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const CHECKOUT_URL = 'http://localhost:5173/checkout';
const LOAD_EVENT = 'browser://tab-load';

type LoadParams = {
  readonly tabId: string;
  readonly phase: 'started' | 'finished';
  readonly url: string;
};
type CommandParams = { readonly command: string };
type PayloadParams = { readonly payload: unknown };

let store: StoryStore;
let history: BrowserHistoryState | null;
let favicon: BrowserTabFavicon | null;
let handlers: Map<string, EventCallback<unknown>>;

const row: BrowserTab = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectId: null,
  url: CHECKOUT_URL,
  title: 'Checkout',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
};

const facts: BrowserTabFacts = {
  id: 'live-1',
  sessionId: SESSION_ID,
  url: CHECKOUT_URL,
  title: 'Checkout',
  state: 'live',
  isShown: true,
  hiddenSinceMs: null,
  openerId: null,
  isPasskeyBlocked: false,
};

const argsOf = ({ payload }: PayloadParams): Readonly<Record<string, unknown>> => {
  const args: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : null;
  return typeof args === 'object' && args !== null ? Object.fromEntries(Object.entries(args)) : {};
};

const callsOf = ({ command }: CommandParams) =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === command)
    .map(([, payload]) => argsOf({ payload }));

const heardLoad = ({ tabId, phase, url }: LoadParams) => {
  act(() => {
    handlers.get(LOAD_EVENT)?.({ event: LOAD_EVENT, id: 1, payload: { tabId, phase, url } });
  });
};

const renderPane = async () => {
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );
  await screen.findByRole('button', { name: 'Edit address, Checkout, localhost:5173' });
  await waitFor(() => expect(handlers.has(LOAD_EVENT)).toBe(true));
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  history = null;
  favicon = null;
  handlers = new Map();
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  vi.mocked(listen).mockImplementation(async (event, handler) => {
    handlers.set(event, handler);
    return () => undefined;
  });
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    browserSessionTabs: { [SESSION_ID]: [row] },
    browserActiveTab: { [SESSION_ID]: row.id },
    browserShownPin: { [SESSION_ID]: null },
    browserLiveTabs: { [SESSION_ID]: { [row.id]: facts.id } },
  });
  stubStoryInvoke({
    browser_tab_rows_list: [row],
    browser_workspace_tab_rows_list: [row],
    browser_tab_list: [facts],
    browser_tab_place: null,
    browser_tab_show: facts,
    browser_tab_hide: facts,
    browser_tab_reload: null,
    browser_tab_back: null,
    browser_tab_forward: null,
    browser_tab_stop: null,
    browser_history_state: () => history,
    browser_favicon: () => favicon,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

describe('the browser pane host facts', () => {
  it('draws the load line and turns Reload into Stop from the started event to the finished one', async () => {
    await renderPane();
    expect(screen.queryByRole('progressbar', { name: 'Loading page' })).toBeNull();
    screen.getByRole('button', { name: 'Reload' });

    heardLoad({ tabId: 'live-1', phase: 'started', url: CHECKOUT_URL });

    screen.getByRole('progressbar', { name: 'Loading page' });
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    screen.getByRole('button', { name: 'Stop' });

    heardLoad({ tabId: 'live-1', phase: 'finished', url: CHECKOUT_URL });

    expect(screen.queryByRole('progressbar', { name: 'Loading page' })).toBeNull();
    screen.getByRole('button', { name: 'Reload' });
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  it('asks for the tab list again when a load finishes so the title does not wait for the poll', async () => {
    await renderPane();
    const before = callsOf({ command: 'browser_tab_list' }).length;

    heardLoad({ tabId: 'live-1', phase: 'started', url: CHECKOUT_URL });
    heardLoad({ tabId: 'live-1', phase: 'finished', url: CHECKOUT_URL });

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_list' }).length).toBeGreaterThan(before),
    );
  });

  it('drops a finished event of an older load whose address differs', async () => {
    await renderPane();

    heardLoad({ tabId: 'live-1', phase: 'started', url: 'http://localhost:5173/pricing' });
    heardLoad({ tabId: 'live-1', phase: 'finished', url: CHECKOUT_URL });

    screen.getByRole('progressbar', { name: 'Loading page' });
    screen.getByRole('button', { name: 'Stop' });
  });

  it('ignores events of a tab the session does not know', async () => {
    await renderPane();

    heardLoad({ tabId: 'live-9', phase: 'started', url: CHECKOUT_URL });

    expect(screen.queryByRole('progressbar', { name: 'Loading page' })).toBeNull();
    expect(store.getState().browserLoads).toEqual({});
  });

  it('stops the shown tab by its live id and turns the line off', async () => {
    await renderPane();
    heardLoad({ tabId: 'live-1', phase: 'started', url: CHECKOUT_URL });

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    await waitFor(() =>
      expect(screen.queryByRole('progressbar', { name: 'Loading page' })).toBeNull(),
    );
    expect(callsOf({ command: 'browser_tab_stop' })).toEqual([{ tabId: 'live-1' }]);
    screen.getByRole('button', { name: 'Reload' });
  });

  it('keeps the line and says why when the host refuses to stop', async () => {
    await renderPane();
    heardLoad({ tabId: 'live-1', phase: 'started', url: CHECKOUT_URL });
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
      if (name === 'browser_tab_stop') {
        throw { kind: 'failed', message: 'tab-gone' };
      }
      return handler?.(name, args);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This tab closed. Open the page again.',
    );
    screen.getByRole('progressbar', { name: 'Loading page' });
  });

  it('turns the line off after 30 seconds without a finished event and says the page did not finish', async () => {
    await renderPane();
    vi.useFakeTimers();
    heardLoad({ tabId: 'live-1', phase: 'started', url: CHECKOUT_URL });
    screen.getByRole('progressbar', { name: 'Loading page' });

    act(() => {
      vi.advanceTimersByTime(LOAD_STALL_MS - 1);
    });
    screen.getByRole('progressbar', { name: 'Loading page' });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByRole('progressbar', { name: 'Loading page' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('The page did not finish loading.');
  });

  it('clears the stalled line when the page finishes late', async () => {
    await renderPane();
    vi.useFakeTimers();
    heardLoad({ tabId: 'live-1', phase: 'started', url: CHECKOUT_URL });
    act(() => {
      vi.advanceTimersByTime(LOAD_STALL_MS);
    });
    screen.getByRole('alert');

    heardLoad({ tabId: 'live-1', phase: 'started', url: CHECKOUT_URL });
    heardLoad({ tabId: 'live-1', phase: 'finished', url: CHECKOUT_URL });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables Back when the host says there is nothing behind and Forward when nothing ahead', async () => {
    history = { canGoBack: false, canGoForward: true };
    await renderPane();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true),
    );
    expect(screen.getByRole('button', { name: 'Forward' }).hasAttribute('disabled')).toBe(false);
  });

  it('keeps both history buttons on when the platform cannot tell', async () => {
    history = null;
    await renderPane();

    await waitFor(() => expect(callsOf({ command: 'browser_history_state' })).not.toEqual([]));
    expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: 'Forward' }).hasAttribute('disabled')).toBe(false);
  });

  it('draws the fetched icon in the address pill and keeps the letter when the host has none', async () => {
    favicon = { origin: 'http://localhost:5173', src: 'data:image/png;base64,AAAA' };
    await renderPane();

    const pill = screen.getByRole('button', { name: 'Edit address, Checkout, localhost:5173' });
    await waitFor(() =>
      expect(pill.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA'),
    );
    expect(pill.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(callsOf({ command: 'browser_favicon' })).toEqual([{ tabId: 'live-1' }]);
  });

  it('asks once for a host with no icon and shows the letter tile', async () => {
    favicon = { origin: 'http://localhost:5173', src: null };
    await renderPane();

    await waitFor(() =>
      expect(store.getState().browserFavicons['http://localhost:5173']).toBeNull(),
    );
    heardLoad({ tabId: 'live-1', phase: 'started', url: CHECKOUT_URL });
    heardLoad({ tabId: 'live-1', phase: 'finished', url: CHECKOUT_URL });

    const pill = screen.getByRole('button', { name: 'Edit address, Checkout, localhost:5173' });
    expect(pill.querySelector('img')).toBeNull();
    expect(pill.textContent).toContain('L');
    expect(callsOf({ command: 'browser_favicon' })).toHaveLength(1);
  });
});
