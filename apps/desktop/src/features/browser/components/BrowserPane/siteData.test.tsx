// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { BrowserSiteCleared, BrowserTabFacts } from '../../types';
import { BrowserPane } from '.';

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
const VIEW_RECT = new DOMRect(480, 96, 640, 720);
const MAC_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const LINUX_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15';

type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type TabArgs = { readonly args: { readonly tabId: string } };
type SaveArgs = { readonly args: { readonly id: string } };
type SiteArgs = { readonly args: { readonly tabId: string; readonly host: string } };
type CommandParams = { readonly command: string };
type ClearParams = { readonly clear: (params: SiteArgs) => BrowserSiteCleared };

let store: StoryStore;
let live: BrowserTabFacts[];

const stubHost = ({ clear }: ClearParams) => {
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
    browser_tab_reload_from_origin: null,
    browser_site_data_clear: clear,
    browser_history_state: null,
    browser_console_read: { doc: null, entries: [], watermark: 0, isHeard: false },
    browser_favicon: null,
  });
};

const callsOf = ({ command }: CommandParams) =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command);

const renderPane = () => {
  store.setState({ drawer: { kind: 'browser', sessionId: SESSION_ID, payload: null } });
  return render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );
};

const openPage = async () => {
  const field =
    screen.queryByRole('combobox', { name: 'Address or search' }) ??
    (() => {
      fireEvent.click(screen.getByRole('button', { name: /^Edit address/ }));
      return screen.getByRole('combobox', { name: 'Address or search' });
    })();
  fireEvent.change(field, { target: { value: 'localhost:5005/login' } });
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

const openMore = () => {
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  return screen.getByRole('menu', { name: 'More' });
};

const reloadRow = async () => {
  const menu = openMore();
  fireEvent.click(within(menu).getByRole('menuitem', { name: /^Develop/ }));
  return screen.findByRole('menuitem', { name: /^Reload without cache/ });
};

const confirmClear = async () => {
  const menu = openMore();
  fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear site data/ }));
  await screen.findByText('Clear data for localhost?');
  fireEvent.click(screen.getByRole('button', { name: 'Clear site data' }));
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  live = [];
  await openStorySqlite();
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
  });
  stubHost({ clear: ({ args }) => ({ host: args.host, scope: 'site' }) });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(MAC_AGENT);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('clear site data', () => {
  it('keeps both rows off while no tab is shown', async () => {
    renderPane();

    expect((await reloadRow()).getAttribute('aria-disabled')).toBe('true');
    const clear = screen.getByRole('menuitem', { name: /Clear site data/ });
    expect(clear.getAttribute('aria-disabled')).toBe('true');
  });

  it('turns both rows on once a page is shown', async () => {
    renderPane();
    await openPage();

    expect((await reloadRow()).getAttribute('aria-disabled')).toBeNull();
    const clear = screen.getByRole('menuitem', { name: /Clear site data/ });
    expect(clear.getAttribute('aria-disabled')).toBeNull();
  });

  it('says the row clears the whole workspace browser off macOS', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(LINUX_AGENT);
    renderPane();
    await openPage();

    const menu = openMore();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear browser data/ }));

    expect(await screen.findByText('Clear browser data for this workspace?')).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: /Clear site data/ })).toBeNull();
  });

  it('asks first, clears the site of the shown tab and says so in the pane', async () => {
    renderPane();
    await openPage();

    const menu = openMore();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear site data/ }));
    expect(await screen.findByText('Clear data for localhost?')).toBeTruthy();
    expect(callsOf({ command: 'browser_site_data_clear' })).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Clear site data' }));

    await waitFor(() =>
      expect(callsOf({ command: 'browser_site_data_clear' })).toEqual([
        ['browser_site_data_clear', { args: { tabId: 'live-1', host: 'localhost' } }],
      ]),
    );
    expect((await screen.findByRole('status')).textContent).toBe('Cleared data for localhost.');
  });

  it('shows the error and leaves the page alone when the clear fails', async () => {
    stubHost({
      clear: () => {
        throw { kind: 'failed', message: 'site-data-unavailable' };
      },
    });
    renderPane();
    await openPage();

    await confirmClear();

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't clear the site data. The page stays as it was.",
    );
    expect(screen.queryByText(/Cleared data/)).toBeNull();
    expect(callsOf({ command: 'browser_tab_reload_from_origin' })).toEqual([]);
    expect(callsOf({ command: 'browser_tab_reload' })).toEqual([]);
  });

  it('reloads without cache from its menu row', async () => {
    renderPane();
    await openPage();

    fireEvent.click(await reloadRow());

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_reload_from_origin' })).toEqual([
        ['browser_tab_reload_from_origin', { args: { tabId: 'live-1' } }],
      ]),
    );
  });
});
