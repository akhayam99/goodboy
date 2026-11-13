// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { listen, type EventCallback } from '@tauri-apps/api/event';
import { nextAgentId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryAgent,
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { BrowserConsoleEntry, BrowserConsoleRead, BrowserTabFacts } from '../../types';
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
const IMPLEMENTER = nextAgentId();
const CHECKOUT_URL = 'http://localhost:5173/checkout';
const LOAD_EVENT = 'browser://tab-load';

type Reader = (args: Readonly<Record<string, unknown>>) => Promise<BrowserConsoleRead>;
type PayloadParams = { readonly payload: unknown };
type EntryParams = Pick<BrowserConsoleEntry, 'seq' | 'level' | 'text'> &
  Partial<Pick<BrowserConsoleEntry, 'kind' | 'method' | 'status' | 'source'>>;
type ReadParams = {
  readonly doc?: string;
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
};

let store: StoryStore;
let reader: Reader;
let handlers: Map<string, Array<EventCallback<unknown>>>;

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

const entryOf = ({
  seq,
  level,
  text,
  kind = 'console',
  method = null,
  status = null,
  source = null,
}: EntryParams): BrowserConsoleEntry => ({ seq, level, text, kind, method, status, source });

const ENTRIES: ReadonlyArray<BrowserConsoleEntry> = [
  entryOf({
    seq: 1,
    level: 'error',
    text: 'TypeError: retry is not a function',
    source: 'checkout.js:214',
  }),
  entryOf({ seq: 2, level: 'warn', text: 'Line "Shipping" was rendered twice' }),
  entryOf({ seq: 3, level: 'info', text: 'cart restored' }),
  entryOf({ seq: 4, level: 'log', text: 'ledger-core: confirm step mounted' }),
  entryOf({
    seq: 5,
    level: 'error',
    text: '/api/orders/confirm',
    kind: 'network',
    method: 'POST',
    status: 500,
  }),
];

const heard = ({ doc = 'k3x9', entries }: ReadParams): BrowserConsoleRead => ({
  doc,
  entries,
  isHeard: true,
});

const UNHEARD: BrowserConsoleRead = { doc: null, entries: [], isHeard: false };

const argsOf = ({ payload }: PayloadParams): Readonly<Record<string, unknown>> => {
  const args: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : null;
  return typeof args === 'object' && args !== null ? Object.fromEntries(Object.entries(args)) : {};
};

const readCalls = () =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'browser_console_read')
    .map(([, payload]) => argsOf({ payload }));

const finishLoad = () => {
  act(() => {
    (handlers.get(LOAD_EVENT) ?? []).forEach((handler) =>
      handler({
        event: LOAD_EVENT,
        id: 1,
        payload: { tabId: 'live-1', phase: 'finished', url: CHECKOUT_URL },
      }),
    );
  });
};

const deferred = () => {
  let settle: (value: BrowserConsoleRead) => void = () => undefined;
  const promise = new Promise<BrowserConsoleRead>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

const renderPane = async () => {
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );
  await screen.findByRole('button', { name: 'Edit address, Checkout, localhost:5173' });
};

const openConsole = async () => {
  await renderPane();
  fireEvent.click(screen.getByRole('button', { name: 'Console' }));
  await waitFor(() => expect(handlers.get(LOAD_EVENT)?.length).toBe(2));
  return screen.findByRole('region', { name: 'Console' });
};

const shownLevels = () =>
  Array.from(
    screen.getByRole('log').querySelectorAll('[data-console-level]'),
    (node) => `${node.getAttribute('data-console-level')} ${node.textContent ?? ''}`,
  );

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  handlers = new Map();
  reader = async () => heard({ entries: ENTRIES });
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  vi.mocked(listen).mockImplementation(async (event, handler) => {
    handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    return () => {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((candidate) => candidate !== handler),
      );
    };
  });
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: {
      [SESSION_ID]: [
        buildStoryAgent({ id: IMPLEMENTER, sessionId: SESSION_ID, name: 'Implementer' }),
      ],
    },
    selectedAgentId: { [SESSION_ID]: IMPLEMENTER },
    browserSessionTabs: { [SESSION_ID]: [row] },
    browserActiveTab: { [SESSION_ID]: row.id },
    browserShownPin: { [SESSION_ID]: null },
    browserLiveTabs: { [SESSION_ID]: { [row.id]: facts.id } },
  });
  store.getState().openDrawer({ kind: 'browser', sessionId: SESSION_ID, payload: null });
  stubStoryInvoke({
    browser_tab_rows_list: [row],
    browser_workspace_tab_rows_list: [row],
    browser_tab_list: [facts],
    browser_tab_place: null,
    browser_tab_show: facts,
    browser_tab_hide: facts,
    browser_history_state: null,
    browser_favicon: null,
    browser_console_read: (payload: unknown) => reader(argsOf({ payload })),
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

describe('the browser console', () => {
  it('reads nothing until the console opens, and keeps the More menu as it was', async () => {
    await renderPane();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = await screen.findByRole('menu', { name: 'More' });

    expect(within(menu).queryByRole('menuitem', { name: /Console/ })).toBeNull();
    expect(readCalls()).toEqual([]);
  });

  it('opens a region under the page with one row per level and counts from one function', async () => {
    const region = await openConsole();

    await waitFor(() => expect(shownLevels()).toHaveLength(4));
    expect(shownLevels()).toEqual([
      'error TypeError: retry is not a functioncheckout.js:214',
      'warn Line "Shipping" was rendered twice',
      'info cart restored',
      'log ledger-core: confirm step mounted',
    ]);
    expect(within(region).getByRole('tab', { name: /Console/ }).textContent).toBe('Console4');
    expect(within(region).getByRole('tab', { name: /Network/ }).textContent).toBe('Network1');
    expect(screen.getByRole('button', { name: 'Console' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    within(region).getByText('Since the last load');

    fireEvent.click(within(region).getByRole('tab', { name: /Network/ }));

    expect(shownLevels()).toEqual(['error POST 500/api/orders/confirm']);
  });

  it('reads with the session, the tab and the cursor, and appends after the answer', async () => {
    await openConsole();
    await waitFor(() => expect(shownLevels()).toHaveLength(4));
    reader = async () =>
      heard({ entries: [entryOf({ seq: 6, level: 'log', text: 'step two mounted' })] });

    finishLoad();

    await waitFor(() => expect(shownLevels()).toHaveLength(5));
    expect(readCalls()[0]).toEqual({ tabId: 'live-1', sessionId: SESSION_ID, doc: null, after: 0 });
    expect(readCalls()[1]).toEqual({
      tabId: 'live-1',
      sessionId: SESSION_ID,
      doc: 'k3x9',
      after: 5,
    });
  });

  it('drops a late answer for an older cursor', async () => {
    const first = deferred();
    const second = deferred();
    const answers = [first.promise, second.promise];
    reader = () => answers.shift() ?? Promise.resolve(heard({ entries: [] }));
    await openConsole();
    finishLoad();
    await waitFor(() => expect(readCalls()).toHaveLength(2));

    await act(async () => {
      second.settle(heard({ entries: ENTRIES.slice(0, 2) }));
    });
    await waitFor(() => expect(shownLevels()).toHaveLength(2));
    await act(async () => {
      first.settle(heard({ entries: ENTRIES.slice(0, 4) }));
    });

    expect(shownLevels()).toHaveLength(2);
  });

  it('drops an answer for a tab that closed while it was read', async () => {
    const late = deferred();
    reader = () => late.promise;
    await openConsole();
    await waitFor(() => expect(readCalls()).toHaveLength(1));

    act(() => {
      store.setState({ browserLiveTabs: { [SESSION_ID]: {} } });
    });
    await act(async () => {
      late.settle(heard({ entries: ENTRIES }));
    });

    expect(screen.queryAllByText('cart restored')).toEqual([]);
  });

  it('clears only the shown region tab', async () => {
    const region = await openConsole();
    await waitFor(() => expect(shownLevels()).toHaveLength(4));
    reader = async () => heard({ entries: [] });

    fireEvent.click(within(region).getByRole('button', { name: 'Clear' }));

    expect(shownLevels()).toEqual([]);
    within(region).getByText('Nothing logged since the last load');
    expect(within(region).getByRole('tab', { name: /Network/ }).textContent).toBe('Network1');
  });

  it('keeps the rows and says it could not read the console when a read fails', async () => {
    await openConsole();
    await waitFor(() => expect(shownLevels()).toHaveLength(4));
    reader = async () => {
      throw { kind: 'failed', message: 'console-unavailable' };
    };

    finishLoad();

    await screen.findByText("Couldn't read the console");
    expect(shownLevels()).toHaveLength(4);
  });

  it('says the console stopped reporting when the reader answers nothing twice after a logged entry', async () => {
    await openConsole();
    await waitFor(() => expect(shownLevels()).toHaveLength(4));
    reader = async () => UNHEARD;

    finishLoad();
    await waitFor(() => expect(readCalls().length).toBeGreaterThanOrEqual(2));
    finishLoad();

    await screen.findByText('Console stopped reporting');
    expect(shownLevels()).toHaveLength(4);
  });

  it('sends a markdown chip named after the tab to the agent the composer targets', async () => {
    const region = await openConsole();
    await waitFor(() => expect(shownLevels()).toHaveLength(4));

    fireEvent.click(within(region).getByRole('button', { name: /Send to Implementer/ }));

    const [handoff] = store.getState().outputHandoffs[IMPLEMENTER] ?? [];
    expect(handoff?.fileName).toBe('checkout-console.md');
    expect(handoff?.mimeType).toBe('text/markdown');
    expect(handoff?.text).toContain('- POST 500 /api/orders/confirm');
    within(region).getByText(
      'Sent as checkout-console.md, a chip in the composer. Nothing goes until you send.',
    );
    expect(storySpies.tauriInvoke.mock.calls.map(([name]) => name)).not.toContain('turn_send');
  });

  it('opens and closes on the console chord', async () => {
    await renderPane();

    await act(async () => {
      pressShortcut({ id: 'browser.console' });
    });
    await screen.findByRole('region', { name: 'Console' });

    await act(async () => {
      pressShortcut({ id: 'browser.console' });
    });
    expect(screen.queryByRole('region', { name: 'Console' })).toBeNull();
  });
});
