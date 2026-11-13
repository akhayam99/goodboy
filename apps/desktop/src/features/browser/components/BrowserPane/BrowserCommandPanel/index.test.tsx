// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import type { BrowserTab, TabOwner } from '../../../../../store/slices/browser/types';
import type { BrowserVisit } from '../../../../../store/slices/browser-visits/types';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { ToastProvider } from '../../../../../shared/components/Toast';
import type { BrowserTabFacts } from '../../../types';
import { BrowserPane } from '../index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const SIBLING_ID = nextSessionId();
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
type CommandParams = { readonly command: string };
type PayloadParams = { readonly payload: unknown };
type TypeParams = { readonly text: string };

let store: StoryStore;
let rows: BrowserTab[];
let live: BrowserTabFacts[];
let visits: BrowserVisit[];

const PR_TAB: BrowserTab = {
  id: 'pr-318',
  sessionId: SIBLING_ID,
  projectId: null,
  url: 'https://northwind.example/pr/318',
  title: 'PR #318',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
};

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
  const facts: BrowserTabFacts = {
    id: `live-${live.length + 1}`,
    sessionId: args.sessionId,
    url: args.url,
    title: 'Checkout',
    state: 'live',
    isShown: false,
    hiddenSinceMs: null,
    openerId: null,
    isPasskeyBlocked: false,
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
    browser_tab_open: ({ args }: OpenArgs) => factsOf({ args }),
    browser_tab_list: () => live,
    browser_history_state: null,
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_navigate: ({ args }: NavigateArgs) => {
      live = live.map((facts) => (facts.id === args.tabId ? { ...facts, url: args.url } : facts));
      return null;
    },
    browser_visits_list: () => visits,
    open_url: null,
  });
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

const rawCallsOf = ({ command }: CommandParams) =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === command)
    .map(([, payload]) => payload);

const fieldOf = () => screen.getByRole('combobox', { name: 'Address or search' });

const submitField = async () => {
  const form = fieldOf().closest('form');
  if (form === null) {
    throw new Error('The address field sits in no form.');
  }
  await act(async () => {
    fireEvent.submit(form);
  });
};

const typeText = ({ text }: TypeParams) => {
  fireEvent.change(fieldOf(), { target: { value: text } });
};

const selectedLabel = () =>
  within(screen.getByRole('listbox', { name: 'Suggestions' }))
    .getAllByRole('option')
    .find((option) => option.getAttribute('aria-selected') === 'true')
    ?.getAttribute('aria-label');

const openFirstPage = async () => {
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );
  typeText({ text: 'localhost:5173/checkout' });
  await submitField();
  const view = await waitFor(() => {
    const found = document.querySelector('[data-browser-view]');
    if (found === null) {
      throw new Error('The pane draws no view placeholder yet.');
    }
    return found;
  });
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(VIEW_RECT.x, VIEW_RECT.y, VIEW_RECT.width, VIEW_RECT.height),
  });
  Object.defineProperty(view, 'checkVisibility', { configurable: true, value: () => true });
  await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));
};

const openField = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Edit address/ }));
  return fieldOf();
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  rows = [PR_TAB];
  live = [];
  visits = [
    { url: 'http://localhost:5173/checkout/confirm', title: 'Confirm order', visitedAt: 3 },
    { url: 'http://localhost:5173/tax', title: 'Tax rates', visitedAt: 2 },
  ];
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [
      buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }),
      buildStorySession({ id: SIBLING_ID, workspaceId: WORKSPACE_ID, goal: 'Fix notify-relay' }),
    ],
  });
  stubHost();
});

afterEach(() => {
  cleanup();
});

describe('the browser command field', () => {
  it('opens under the row with this session visits and runs the first one on ↩', async () => {
    await openFirstPage();

    await openField();
    await screen.findByRole('option', { name: 'Confirm order' });

    expect(rawCallsOf({ command: 'browser_visits_list' }).at(-1)).toEqual({
      args: { sessionId: SESSION_ID },
    });
    expect(selectedLabel()).toBe('Confirm order');
    await submitField();

    expect(callsOf({ command: 'browser_tab_navigate' })).toEqual([
      { tabId: 'live-1', url: 'http://localhost:5173/checkout/confirm' },
    ]);
    await screen.findByRole('button', { name: /^Edit address/ });
    expect(screen.queryByRole('listbox', { name: 'Suggestions' })).toBeNull();
  });

  it('moves the highlight with the arrows and wraps at both ends', async () => {
    await openFirstPage();
    const field = await openField();
    await screen.findByRole('option', { name: 'Tax rates' });

    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(selectedLabel()).toBe('Tax rates');
    expect(field.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Tax rates' }).id,
    );
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(selectedLabel()).toBe('Confirm order');
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(selectedLabel()).toBe('Tax rates');
  });

  it('opens a typed address in your browser on ⌘↩ and loads nothing beside the session', async () => {
    await openFirstPage();
    const field = await openField();

    typeText({ text: 'localhost:8080' });
    expect(selectedLabel()).toBe('localhost:8080');
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    });

    expect(rawCallsOf({ command: 'open_url' })).toEqual([{ url: 'http://localhost:8080/' }]);
    expect(callsOf({ command: 'browser_tab_navigate' })).toEqual([]);
    await screen.findByRole('button', { name: /^Edit address/ });
  });

  it('finds a tab of another session by a word and shows it in that session', async () => {
    await openFirstPage();
    await openField();

    typeText({ text: 'northwind' });
    const option = await screen.findByRole('option', { name: 'PR #318' });
    expect(option.textContent).toContain('northwind.example/pr/318');
    fireEvent.mouseDown(option);

    expect(store.getState().browserActiveTab[SIBLING_ID]).toBe('pr-318');
    expect(selectDrawerPanel(store.getState())).toMatchObject({
      kind: 'browser',
      sessionId: SIBLING_ID,
    });
    expect(callsOf({ command: 'browser_tab_navigate' })).toEqual([]);
  });

  it('restores the title pill on Escape and keeps the address', async () => {
    await openFirstPage();
    const field = await openField();
    await screen.findByRole('listbox', { name: 'Suggestions' });

    typeText({ text: 'tax' });
    fireEvent.keyDown(field, { key: 'Escape' });

    screen.getByRole('button', { name: /^Edit address/ });
    expect(screen.queryByRole('listbox', { name: 'Suggestions' })).toBeNull();
    expect(callsOf({ command: 'browser_tab_navigate' })).toEqual([]);
  });
});
