// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectId, SessionId } from '@goodboy/types';
import { nextProjectId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryProject,
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import type { BrowserTab, TabOwner } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { BrowserTabFacts } from '../../types';
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
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});
const VIEW_RECT = { x: 480, y: 96, width: 640, height: 720 };

type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type TabArgs = { readonly args: { readonly tabId: string } };
type NavigateArgs = { readonly args: { readonly tabId: string; readonly url: string } };
type SaveArgs = {
  readonly args: {
    readonly id: string;
    readonly owner: TabOwner;
    readonly url: string;
    readonly title: string;
  };
};
type OwnerArgs = { readonly args: { readonly owner: TabOwner } };
type DeleteArgs = { readonly args: { readonly id: string } };
type MoveArgs = {
  readonly args: { readonly id: string; readonly projectId: ProjectId };
};
type RectParams = { readonly element: Element; readonly rect: typeof VIEW_RECT };
type CommandParams = { readonly command: string };
type PayloadParams = { readonly payload: unknown };
type TypeParams = { readonly text: string };
type FailParams = { readonly command: string; readonly reason: string };

let store: StoryStore;
let rows: BrowserTab[];
let live: BrowserTabFacts[];
let opened: number;

const rowOf = ({ args }: SaveArgs): BrowserTab => ({
  id: args.id,
  sessionId: args.owner.kind === 'session' ? args.owner.sessionId : null,
  projectId: args.owner.kind === 'project' ? args.owner.projectId : null,
  url: args.url,
  title: args.title,
  position: rows.length,
  createdAt: 1,
  updatedAt: 1,
});

const factsOf = ({ args }: OpenArgs): BrowserTabFacts => {
  opened += 1;
  const facts: BrowserTabFacts = {
    id: `live-${opened}`,
    sessionId: args.sessionId,
    url: args.url,
    title: '',
    isShown: false,
    hiddenSinceMs: null,
    openerId: null,
  };
  live = [...live, facts];
  return facts;
};

const stubHost = () => {
  stubStoryInvoke({
    browser_tab_rows_list: ({ args }: OwnerArgs) =>
      rows.filter((row) =>
        args.owner.kind === 'session'
          ? row.sessionId === args.owner.sessionId
          : row.projectId === args.owner.projectId,
      ),
    browser_tab_row_save: ({ args }: SaveArgs) => {
      const row = rowOf({ args });
      rows = [...rows.filter((existing) => existing.id !== row.id), row];
      return row;
    },
    browser_tab_row_delete: ({ args }: DeleteArgs) => {
      rows = rows.filter((row) => row.id !== args.id);
      return null;
    },
    browser_tab_row_pin: ({ args }: MoveArgs) => {
      const row = rows.find((candidate) => candidate.id === args.id);
      if (row === undefined) {
        throw { kind: 'failed', message: 'tab-row-gone' };
      }
      const moved: BrowserTab = { ...row, sessionId: null, projectId: args.projectId };
      rows = rows.map((candidate) => (candidate.id === args.id ? moved : candidate));
      return moved;
    },
    browser_tab_open: ({ args }: OpenArgs) => factsOf({ args }),
    browser_tab_list: () => live,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_navigate: ({ args }: NavigateArgs) => {
      live = live.map((facts) => (facts.id === args.tabId ? { ...facts, url: args.url } : facts));
      return null;
    },
    browser_tab_back: null,
    browser_tab_forward: null,
    browser_tab_reload: null,
    browser_tab_close: ({ args }: TabArgs) => {
      live = live.filter((facts) => facts.id !== args.tabId);
      return null;
    },
  });
};

const failCommand = ({ command, reason }: FailParams) => {
  const handler = storySpies.tauriInvoke.getMockImplementation();
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    if (name === command) {
      throw { kind: 'refused', message: reason };
    }
    return handler?.(name, args);
  });
};

const failOnce = ({ command, reason }: FailParams) => {
  const handler = storySpies.tauriInvoke.getMockImplementation();
  let hasFailed = false;
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    if (name === command && !hasFailed) {
      hasFailed = true;
      throw { kind: 'refused', message: reason };
    }
    return handler?.(name, args);
  });
};

const holdOpens = () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = storySpies.tauriInvoke.getMockImplementation();
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    if (name === 'browser_tab_open') {
      await gate;
    }
    return handler?.(name, args);
  });
  return { release: () => release() };
};

const storedRow = (): BrowserTab => ({
  id: 'row-1',
  sessionId: SESSION_ID,
  projectId: null,
  url: 'https://acme.example/',
  title: 'Acme',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const coverView = (): HTMLElement => {
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  giveRect({ element: menu, rect: { x: 900, y: 120, width: 240, height: 200 } });
  act(() => {
    document.body.append(menu);
  });
  return menu;
};

const pageGoesTo = ({ text }: TypeParams) => {
  live = live.map((facts) => (facts.id === 'live-1' ? { ...facts, url: text } : facts));
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
};

const storedUrl = () => store.getState().browserSessionTabs[SESSION_ID]?.[0]?.url;

const argsOf = ({ payload }: PayloadParams): Readonly<Record<string, unknown>> => {
  const args: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : null;
  return typeof args === 'object' && args !== null ? Object.fromEntries(Object.entries(args)) : {};
};

const callsOf = ({ command }: CommandParams) =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === command)
    .map(([, payload]) => argsOf({ payload }));

const giveRect = ({ element, rect }: RectParams) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(rect.x, rect.y, rect.width, rect.height),
  });
  Object.defineProperty(element, 'checkVisibility', { configurable: true, value: () => true });
};

const placeView = async () => {
  const view = await waitFor(() => {
    const found = document.querySelector('[data-browser-view]');
    if (found === null) {
      throw new Error('The pane draws no view placeholder yet.');
    }
    return found;
  });
  giveRect({ element: view, rect: VIEW_RECT });
};

const renderPane = () =>
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );

const typeAddress = async ({ text }: TypeParams) => {
  const field = screen.getByRole('textbox', { name: 'Address' });
  fireEvent.change(field, { target: { value: text } });
  const form = field.closest('form');
  if (form === null) {
    throw new Error('The address field sits in no form.');
  }
  await act(async () => {
    fireEvent.submit(form);
  });
};

const openFirstPage = async () => {
  renderPane();
  await typeAddress({ text: 'localhost:5173/checkout' });
  await placeView();
  await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  rows = [];
  live = [];
  opened = 0;
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id })],
    },
  });
  stubHost();
});

afterEach(() => {
  cleanup();
});

describe('the browser pane', () => {
  it('opens a typed address in a new tab and shows its view where the placeholder is', async () => {
    renderPane();
    screen.getByText('Open a page beside the session');

    await typeAddress({ text: 'localhost:5173/checkout' });
    await placeView();
    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));

    expect(callsOf({ command: 'browser_tab_open' })).toEqual([
      expect.objectContaining({
        sessionId: SESSION_ID,
        url: 'http://localhost:5173/checkout',
        isShown: false,
      }),
    ]);
    expect(store.getState().browserSessionTabs[SESSION_ID]?.map((tab) => tab.id)).toEqual([
      'live-1',
    ]);
    expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      tabId: 'live-1',
      bounds: VIEW_RECT,
    });
    expect(callsOf({ command: 'browser_tab_show' })).toEqual([{ tabId: 'live-1' }]);
  });

  it('refuses words inline and never asks the host to load them', async () => {
    renderPane();

    await typeAddress({ text: 'checkout total' });

    expect(screen.getByRole('alert').textContent).toBe(
      "Type a full address, like harborline.dev. Search isn't available here.",
    );
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });

  it('navigates the shown tab and steps its history by its live id', async () => {
    await openFirstPage();

    await typeAddress({ text: 'harborline.dev/billing' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(callsOf({ command: 'browser_tab_reload' })).toHaveLength(1));
    expect(callsOf({ command: 'browser_tab_navigate' })).toEqual([
      { tabId: 'live-1', url: 'https://harborline.dev/billing' },
    ]);
    expect(callsOf({ command: 'browser_tab_back' })).toEqual([{ tabId: 'live-1' }]);
    expect(callsOf({ command: 'browser_tab_forward' })).toEqual([{ tabId: 'live-1' }]);
    expect(callsOf({ command: 'browser_tab_open' })).toHaveLength(1);
  });

  it('keeps the old address and says why when the host refuses a navigation', async () => {
    await openFirstPage();
    failCommand({ command: 'browser_tab_navigate', reason: 'not-web-address' });

    await typeAddress({ text: 'acme.example' });

    expect(screen.getByRole('alert').textContent).toBe("That address can't open here.");
    expect(store.getState().browserSessionTabs[SESSION_ID]?.[0]?.url).toBe(
      'http://localhost:5173/checkout',
    );
  });

  it('closes a tab on the host before it deletes its row', async () => {
    await openFirstPage();
    fireEvent.click(screen.getByRole('button', { name: 'Close localhost:5173' }));

    await waitFor(() => expect(store.getState().browserSessionTabs[SESSION_ID]).toEqual([]));
    const order = storySpies.tauriInvoke.mock.calls
      .map(([name]) => name)
      .filter((name) => name === 'browser_tab_close' || name === 'browser_tab_row_delete');
    expect(order).toEqual(['browser_tab_close', 'browser_tab_row_delete']);
    expect(store.getState().browserLiveTabs[SESSION_ID]).toEqual({});
  });

  it('pins the shown tab to the project and keeps showing it', async () => {
    await openFirstPage();

    fireEvent.click(screen.getByRole('button', { name: 'Pin to payments-api' }));

    const unpin = await screen.findByRole('button', { name: 'Unpin from payments-api' });
    expect(unpin.getAttribute('aria-pressed')).toBe('true');
    expect(callsOf({ command: 'browser_tab_row_pin' })).toEqual([
      expect.objectContaining({ id: 'live-1', sessionId: SESSION_ID, projectId: PAYMENTS_API.id }),
    ]);
    expect(store.getState().browserProjectPins[PAYMENTS_API.id]?.map((pin) => pin.id)).toEqual([
      'live-1',
    ]);
    expect(callsOf({ command: 'browser_tab_hide' })).toEqual([]);
  });

  it('hides the view while an overlay covers it and shows it again after', async () => {
    await openFirstPage();
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    giveRect({ element: menu, rect: { x: 900, y: 120, width: 240, height: 200 } });

    act(() => {
      document.body.append(menu);
    });
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_hide' })).toEqual([{ tabId: 'live-1' }]),
    );

    act(() => {
      menu.remove();
    });
    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(2));
  });

  it('hides the view while a studio page covers the session', async () => {
    await openFirstPage();
    const studio = document.createElement('div');
    studio.setAttribute('data-studio-slot', 'content');
    giveRect({ element: studio, rect: { x: 248, y: 40, width: 1192, height: 860 } });

    act(() => {
      document.body.append(studio);
    });

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_hide' })).toEqual([{ tabId: 'live-1' }]),
    );
    studio.remove();
  });

  it('leaves the view shown for an overlay elsewhere in the window', async () => {
    await openFirstPage();
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    giveRect({ element: menu, rect: { x: 8, y: 600, width: 300, height: 240 } });

    act(() => {
      document.body.append(menu);
    });
    await act(() => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));

    expect(callsOf({ command: 'browser_tab_hide' })).toEqual([]);
    menu.remove();
  });

  it('closes a tab whose open answered after a newer open, and keeps only the newer one', async () => {
    let releaseFirst: (() => void) | null = null;
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
      if (name === 'browser_tab_open' && opened === 0) {
        const url = argsOf({ payload: args })['url'];
        const facts = factsOf({
          args: { sessionId: SESSION_ID, url: typeof url === 'string' ? url : '' },
        });
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        return facts;
      }
      return handler?.(name, args);
    });
    renderPane();

    await typeAddress({ text: 'northwind.example' });
    await typeAddress({ text: 'acme.example' });
    await act(async () => {
      releaseFirst?.();
    });

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_close' })).toEqual([{ tabId: 'live-1' }]),
    );
    expect(store.getState().browserSessionTabs[SESSION_ID]?.map((tab) => tab.url)).toEqual([
      'https://acme.example/',
    ]);
  });

  it('retries a hide that failed while an overlay covers the view', async () => {
    await openFirstPage();
    failOnce({ command: 'browser_tab_hide', reason: 'host-busy' });

    const menu = coverView();

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_hide' })).toEqual([
        { tabId: 'live-1' },
        { tabId: 'live-1' },
      ]),
    );
    expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1);
    menu.remove();
  });

  it('retries hiding the old tab when a tab switch could not hide it', async () => {
    await openFirstPage();
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    await typeAddress({ text: 'acme.example' });
    await placeView();
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_show' }).at(-1)).toEqual({ tabId: 'live-2' }),
    );
    failOnce({ command: 'browser_tab_hide', reason: 'host-busy' });

    fireEvent.click(screen.getByRole('button', { name: 'localhost:5173' }));
    await placeView();

    await waitFor(() =>
      expect(
        callsOf({ command: 'browser_tab_hide' }).filter((args) => args['tabId'] === 'live-2'),
      ).toHaveLength(2),
    );
    expect(callsOf({ command: 'browser_tab_show' }).at(-1)).toEqual({ tabId: 'live-1' });
  });

  it('never shows a tab whose wake answered after an overlay covered the view', async () => {
    rows = [storedRow()];
    const opens = holdOpens();
    renderPane();
    await placeView();
    await waitFor(() => expect(callsOf({ command: 'browser_tab_open' })).toHaveLength(1));

    const menu = coverView();
    await act(() => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));
    await act(async () => {
      opens.release();
    });
    await act(() => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())));

    expect(callsOf({ command: 'browser_tab_show' })).toEqual([]);
    act(() => {
      menu.remove();
    });
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_show' })).toEqual([{ tabId: 'live-1' }]),
    );
  });

  it('wakes a tab again on Reload after its first wake failed', async () => {
    rows = [storedRow()];
    failOnce({ command: 'browser_tab_open', reason: 'host-busy' });
    renderPane();
    await placeView();
    await screen.findByRole('alert');
    expect(callsOf({ command: 'browser_tab_show' })).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_show' })).toEqual([{ tabId: 'live-1' }]),
    );
    expect(callsOf({ command: 'browser_tab_open' })).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('saves an address the page comes back to after leaving it', async () => {
    await openFirstPage();

    pageGoesTo({ text: 'https://acme.example/billing' });
    await waitFor(() => expect(storedUrl()).toBe('https://acme.example/billing'));
    pageGoesTo({ text: 'http://localhost:5173/checkout' });
    await waitFor(() => expect(storedUrl()).toBe('http://localhost:5173/checkout'));
    pageGoesTo({ text: 'https://acme.example/billing' });

    await waitFor(() => expect(storedUrl()).toBe('https://acme.example/billing'));
  });

  it('saves the live address again after a save failed', async () => {
    await openFirstPage();
    failOnce({ command: 'browser_tab_row_save', reason: 'db-busy' });

    pageGoesTo({ text: 'https://acme.example/billing' });
    await waitFor(() => expect(callsOf({ command: 'browser_tab_row_save' })).toHaveLength(2));
    expect(storedUrl()).toBe('http://localhost:5173/checkout');
    live = live.map((facts) => ({ ...facts, title: 'Billing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => expect(storedUrl()).toBe('https://acme.example/billing'));
  });

  it('hides the view when the pane closes', async () => {
    await openFirstPage();

    cleanup();

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_hide' })).toEqual([{ tabId: 'live-1' }]),
    );
  });
});
