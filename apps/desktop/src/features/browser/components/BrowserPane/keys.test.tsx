// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
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
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { registerShortcut } from '../../../../shared/keyboard/dispatcher';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
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

type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type TabArgs = { readonly args: { readonly tabId: string } };
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
type PinArgs = { readonly args: { readonly id: string; readonly projectId: string } };
type CommandParams = { readonly command: string };
type PayloadParams = { readonly payload: unknown };
type TypeParams = { readonly text: string };
type PressParams = { readonly id: ShortcutId };

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
    browser_tab_row_pin: ({ args }: PinArgs) => {
      const row = rows.find((candidate) => candidate.id === args.id);
      if (row === undefined) {
        throw { kind: 'failed', message: 'tab-row-gone' };
      }
      const moved: BrowserTab = {
        ...row,
        sessionId: null,
        projectId: store.getState().projects[0]?.id ?? null,
      };
      rows = rows.map((candidate) => (candidate.id === args.id ? moved : candidate));
      return moved;
    },
    browser_tab_open: ({ args }: OpenArgs) => factsOf({ args }),
    browser_tab_list: () => live,
    browser_history_state: null,
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_navigate: null,
    browser_tab_back: null,
    browser_tab_forward: null,
    browser_tab_reload: null,
    browser_tab_close: ({ args }: TabArgs) => {
      live = live.filter((facts) => facts.id !== args.tabId);
      return null;
    },
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

const press = async ({ id }: PressParams) => {
  await act(async () => {
    pressShortcut({ id });
  });
};

const typeAddress = async ({ text }: TypeParams) => {
  const field = await screen.findByRole('combobox', { name: 'Address or search' });
  fireEvent.change(field, { target: { value: text } });
  const form = field.closest('form');
  if (form === null) {
    throw new Error('The address field sits in no form.');
  }
  await act(async () => {
    fireEvent.submit(form);
  });
};

const tabIds = () => store.getState().browserSessionTabs[SESSION_ID]?.map((tab) => tab.id);

const shownId = () => store.getState().browserActiveTab[SESSION_ID];

const openTwoPages = async () => {
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );
  await typeAddress({ text: 'localhost:5173/checkout' });
  await waitFor(() => expect(tabIds()).toEqual(['live-1']));
  await press({ id: 'browser.newTab' });
  await typeAddress({ text: 'harborline.dev/billing' });
  await waitFor(() => expect(tabIds()).toEqual(['live-1', 'live-2']));
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
  store.getState().openDrawer({ kind: 'browser', sessionId: SESSION_ID, payload: null });
  stubHost();
});

afterEach(() => {
  cleanup();
});

describe('the browser keymap', () => {
  it('opens an empty command field on the new tab key and opens the typed page as a second tab', async () => {
    await openTwoPages();

    expect(callsOf({ command: 'browser_tab_open' })).toHaveLength(2);
    expect(shownId()).toBe('live-2');
  });

  it('closes the shown tab, selects its neighbour and remembers it for reopening', async () => {
    await openTwoPages();

    await press({ id: 'browser.closeTab' });

    await waitFor(() => expect(tabIds()).toEqual(['live-1']));
    expect(callsOf({ command: 'browser_tab_close' })).toEqual([{ tabId: 'live-2' }]);
    expect(shownId()).toBe('live-1');
    expect(store.getState().browserClosedTabs[SESSION_ID]).toEqual([
      { url: 'https://harborline.dev/billing', title: '' },
    ]);
  });

  it('reopens the last closed tab and drops it from the stack once it is open', async () => {
    await openTwoPages();
    await press({ id: 'browser.closeTab' });
    await waitFor(() => expect(tabIds()).toEqual(['live-1']));

    await press({ id: 'browser.reopenTab' });

    await waitFor(() => expect(tabIds()).toEqual(['live-1', 'live-3']));
    expect(callsOf({ command: 'browser_tab_open' }).at(-1)).toEqual(
      expect.objectContaining({ url: 'https://harborline.dev/billing' }),
    );
    expect(store.getState().browserClosedTabs[SESSION_ID]).toEqual([]);
  });

  it('keeps the closed tab in the stack when it cannot be reopened', async () => {
    await openTwoPages();
    await press({ id: 'browser.closeTab' });
    await waitFor(() => expect(tabIds()).toEqual(['live-1']));
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
      if (name === 'browser_tab_open') {
        throw { kind: 'refused', message: 'host-down' };
      }
      return handler?.(name, args);
    });

    await press({ id: 'browser.reopenTab' });

    await screen.findByRole('alert');
    expect(store.getState().browserClosedTabs[SESSION_ID]).toHaveLength(1);
    expect(tabIds()).toEqual(['live-1']);
  });

  it('steps to the next and previous tab and wraps around the list', async () => {
    await openTwoPages();

    await press({ id: 'browser.nextTab' });
    expect(shownId()).toBe('live-1');
    await press({ id: 'browser.prevTab' });
    expect(shownId()).toBe('live-2');
  });

  it('lets the key fall through to the page close when no tab is left', async () => {
    const closePage = vi.fn();
    const stop = registerShortcut('app.close', closePage);
    render(
      <ToastProvider>
        <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
      </ToastProvider>,
    );

    await press({ id: 'browser.closeTab' });
    stop();

    expect(closePage).toHaveBeenCalledTimes(1);
  });

  it('never closes a pin with the close key and does not let it fall through', async () => {
    await openTwoPages();
    fireEvent.click(screen.getByRole('button', { name: 'Pin to payments-api' }));
    await waitFor(() => expect(store.getState().browserShownPin[SESSION_ID]).toBe('live-2'));
    const closePage = vi.fn();
    const stop = registerShortcut('app.close', closePage);

    await press({ id: 'browser.closeTab' });
    stop();

    expect(callsOf({ command: 'browser_tab_close' })).toEqual([]);
    expect(closePage).not.toHaveBeenCalled();
  });

  it('pins and unpins the shown tab with the pin key', async () => {
    await openTwoPages();

    await press({ id: 'browser.pin' });
    await waitFor(() => expect(store.getState().browserShownPin[SESSION_ID]).toBe('live-2'));
    expect(callsOf({ command: 'browser_tab_row_pin' })).toHaveLength(1);
    await screen.findByRole('button', { name: 'Unpin from payments-api' });
  });

  it('is silent while the browser is not on screen', async () => {
    await openTwoPages();
    act(() => {
      store.getState().closeDrawer();
    });

    await press({ id: 'browser.closeTab' });

    expect(callsOf({ command: 'browser_tab_close' })).toEqual([]);
    expect(tabIds()).toEqual(['live-1', 'live-2']);
  });
});
