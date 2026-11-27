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
import type { BrowserSiteCleared, BrowserTabFacts, BrowserTabState } from '../../types';
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
const POLLED = { timeout: 4000 };

type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type TabArgs = { readonly args: { readonly tabId: string } };
type SaveArgs = { readonly args: { readonly id: string } };
type SiteArgs = {
  readonly args: {
    readonly tabId: string;
    readonly host: string;
    readonly extraHosts: ReadonlyArray<string>;
  };
};
type CommandParams = { readonly command: string };
type MenuParams = { readonly menu: HTMLElement };
type TrailAnswer = ReadonlyArray<string> | Promise<ReadonlyArray<string>>;
type ClearParams = {
  readonly clear: (params: SiteArgs) => BrowserSiteCleared | Promise<BrowserSiteCleared>;
  readonly trail?: (params: TabArgs) => TrailAnswer;
};
type PageParams = { readonly address: string; readonly shows: number };
type HostsParams = { readonly host: string; readonly extraHosts: ReadonlyArray<string> };

const NO_TRAIL = (): ReadonlyArray<string> => [];
const SIGN_IN_TRAIL = (): ReadonlyArray<string> => ['localhost', 'login.cascadia-id.com'];

let store: StoryStore;
let live: BrowserTabFacts[];
let hiddenState: BrowserTabState;

const stubHost = ({ clear, trail = NO_TRAIL }: ClearParams) => {
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
    browser_tab_hide: ({ args }: TabArgs) => {
      live = live.map((facts) =>
        facts.id === args.tabId ? { ...facts, state: hiddenState, isShown: false } : facts,
      );
      return live.find((facts) => facts.id === args.tabId);
    },
    browser_tab_reload: null,
    browser_tab_reload_from_origin: null,
    browser_site_data_clear: clear,
    browser_tab_trail: trail,
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

const cleared = ({ host, extraHosts }: HostsParams): BrowserSiteCleared => ({
  host,
  extraHosts,
  scope: 'site',
});

const openPage = async (
  { address, shows }: PageParams = { address: 'localhost:5005/login', shows: 1 },
) => {
  const field =
    screen.queryByRole('combobox', { name: 'Address or search' }) ??
    (() => {
      fireEvent.click(screen.getByRole('button', { name: /^Edit address/ }));
      return screen.getByRole('combobox', { name: 'Address or search' });
    })();
  fireEvent.change(field, { target: { value: address } });
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
  await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(shows));
};

const waitForTrail = async () => {
  await waitFor(() => expect(callsOf({ command: 'browser_tab_trail' }).length).toBeGreaterThan(0));
};

const openMore = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Page menu' }));
  return screen.getByRole('menu', { name: 'Page menu' });
};

const coverPage = async ({ menu }: MenuParams) => {
  const surface = menu.closest('[data-dropdown-portal] > *');
  if (surface === null) {
    throw new Error('The menu sits in no dropdown portal.');
  }
  Object.defineProperty(surface, 'getBoundingClientRect', {
    configurable: true,
    value: () => VIEW_RECT,
  });
  await waitFor(() => expect(callsOf({ command: 'browser_tab_hide' })).toHaveLength(1));
};

const waitForPoll = async () => {
  const seen = callsOf({ command: 'browser_tab_list' }).length;
  await waitFor(
    () => expect(callsOf({ command: 'browser_tab_list' }).length).toBeGreaterThan(seen),
    POLLED,
  );
};

const reloadButton = () => screen.getByRole('button', { name: 'Reload' });

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
  hiddenState = 'asleep';
  await openStorySqlite();
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
  });
  stubHost({ clear: ({ args }) => cleared(args) });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(MAC_AGENT);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('clear site data', () => {
  it('offers no page menu and keeps Reload off while no tab is shown', async () => {
    renderPane();

    expect(reloadButton().hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Page menu' })).toBeNull();
  });

  it('turns Reload and the clear row on once a page is shown', async () => {
    renderPane();
    await openPage();

    expect(reloadButton().hasAttribute('disabled')).toBe(false);
    openMore();
    const clear = screen.getByRole('menuitem', { name: /Clear site data/ });
    expect(clear.getAttribute('aria-disabled')).toBeNull();
  });

  it('says the row clears the whole workspace browser off macOS', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(LINUX_AGENT);
    renderPane();
    await openPage();

    const menu = openMore();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear browser data/ }));

    await screen.findByText('Clear browser data for this workspace?');
    expect(within(menu).queryByRole('menuitem', { name: /Clear site data/ })).toBeNull();
  });

  it('asks first, clears the site of the shown tab and says so in the pane', async () => {
    renderPane();
    await openPage();

    const menu = openMore();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear site data/ }));
    await screen.findByText('Clear data for localhost?');
    expect(callsOf({ command: 'browser_site_data_clear' })).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Clear site data' }));

    await waitFor(() =>
      expect(callsOf({ command: 'browser_site_data_clear' })).toEqual([
        [
          'browser_site_data_clear',
          { args: { tabId: 'live-1', host: 'localhost', extraHosts: [] } },
        ],
      ]),
    );
    expect((await screen.findByRole('status')).textContent).toBe(
      'Cleared data for localhost. Other tabs on it keep their page until you reload them.',
    );
  });

  it('names the sign-in sites the tab went through and clears them with it', async () => {
    stubHost({ clear: ({ args }) => cleared(args), trail: SIGN_IN_TRAIL });
    renderPane();
    await openPage();
    await waitForTrail();

    const menu = openMore();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear site data/ }));
    await screen.findByText('Signs you out of these sites. Other sites keep their data.');
    screen.getByText('localhost, this site');
    screen.getByText('login.cascadia-id.com, a sign-in this tab went through');

    fireEvent.click(screen.getByRole('button', { name: 'Clear site data' }));

    await waitFor(() =>
      expect(callsOf({ command: 'browser_site_data_clear' })).toEqual([
        [
          'browser_site_data_clear',
          {
            args: { tabId: 'live-1', host: 'localhost', extraHosts: ['login.cascadia-id.com'] },
          },
        ],
      ]),
    );
    expect((await screen.findByRole('status')).textContent).toBe(
      'Cleared data for localhost and login.cascadia-id.com. Other tabs on these sites keep their page until you reload them.',
    );
  });

  it('leaves out of the sign-in list a host that shares the page site', async () => {
    stubHost({
      clear: ({ args }) => cleared(args),
      trail: () => ['app.harborline.dev', 'harborline.dev', 'login.cascadia-id.com'],
    });
    renderPane();
    await openPage({ address: 'https://app.harborline.dev/login', shows: 1 });
    await waitForTrail();

    const menu = openMore();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear site data/ }));

    await screen.findByText('app.harborline.dev, this site');
    screen.getByText('login.cascadia-id.com, a sign-in this tab went through');
    expect(screen.queryByText(/^harborline\.dev/)).toBeNull();
  });

  it('names a tenant under the page host, which the site clear leaves alone', async () => {
    stubHost({
      clear: ({ args }) => cleared(args),
      trail: () => ['github.io', 'harborline.github.io'],
    });
    renderPane();
    await openPage({ address: 'https://github.io/login', shows: 1 });
    await waitForTrail();

    const menu = openMore();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear site data/ }));

    await screen.findByText('github.io, this site');
    screen.getByText('harborline.github.io, a sign-in this tab went through');
  });

  it('asks about the site alone while the trail is still being read', async () => {
    stubHost({
      clear: ({ args }) => cleared(args),
      trail: () => new Promise<ReadonlyArray<string>>(() => undefined),
    });
    renderPane();
    await openPage();
    await waitForTrail();

    await confirmClear();

    expect(screen.queryByText(/a sign-in this tab went through/)).toBeNull();
    await waitFor(() =>
      expect(callsOf({ command: 'browser_site_data_clear' })).toEqual([
        [
          'browser_site_data_clear',
          { args: { tabId: 'live-1', host: 'localhost', extraHosts: [] } },
        ],
      ]),
    );
  });

  it('drops a trail that answers after another tab took its place', async () => {
    let answer: (hosts: ReadonlyArray<string>) => void = () => undefined;
    stubHost({
      clear: ({ args }) => cleared(args),
      trail: ({ args }) =>
        args.tabId === 'live-1'
          ? new Promise<ReadonlyArray<string>>((resolve) => {
              answer = resolve;
            })
          : ['127.0.0.1'],
    });
    renderPane();
    await openPage();
    await waitForTrail();
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    await openPage({ address: '127.0.0.1:5005/home', shows: 2 });
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_trail' })).toContainEqual([
        'browser_tab_trail',
        { args: { tabId: 'live-2' } },
      ]),
    );

    await act(async () => {
      answer(['localhost', 'login.cascadia-id.com']);
    });
    const menu = openMore();
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Clear site data/ }));

    await screen.findByText('Clear data for 127.0.0.1?');
    expect(screen.queryByText(/cascadia/)).toBeNull();
  });

  it('clears again after a second clear was busy', async () => {
    let isBusy = true;
    stubHost({
      clear: ({ args }) => {
        if (isBusy) {
          isBusy = false;
          throw { kind: 'refused', message: 'profile-busy' };
        }
        return cleared(args);
      },
      trail: SIGN_IN_TRAIL,
    });
    renderPane();
    await openPage();
    await waitForTrail();

    await confirmClear();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Browser data is already clearing. Try again in a moment.',
    );
    expect(callsOf({ command: 'browser_tab_reload_from_origin' })).toEqual([]);

    await confirmClear();

    await waitFor(() => expect(callsOf({ command: 'browser_site_data_clear' })).toHaveLength(2));
    expect(callsOf({ command: 'browser_site_data_clear' })[1]).toEqual([
      'browser_site_data_clear',
      { args: { tabId: 'live-1', host: 'localhost', extraHosts: ['login.cascadia-id.com'] } },
    ]);
    expect((await screen.findByRole('status')).textContent).toMatch(
      /^Cleared data for localhost and login\.cascadia-id\.com\./,
    );
    expect(screen.queryByRole('alert')).toBeNull();
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

  it('clears the site of a page the open menu has hidden', async () => {
    renderPane();
    await openPage();
    const menu = openMore();
    await coverPage({ menu });
    await waitForPoll();

    const row = within(menu).getByRole('menuitem', { name: /Clear site data/ });
    expect(row.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(row);
    fireEvent.click(await screen.findByRole('button', { name: 'Clear site data' }));

    await waitFor(() =>
      expect(callsOf({ command: 'browser_site_data_clear' })).toEqual([
        [
          'browser_site_data_clear',
          { args: { tabId: 'live-1', host: 'localhost', extraHosts: [] } },
        ],
      ]),
    );
  });

  it('turns the clear row off once the page view is closed', async () => {
    renderPane();
    await openPage();
    const menu = openMore();
    hiddenState = 'closed';
    await coverPage({ menu });

    const row = within(menu).getByRole('menuitem', { name: /Clear site data/ });
    await waitFor(() => expect(row.getAttribute('aria-disabled')).toBe('true'), POLLED);
  });

  it('drops the failure of a clear that answers after the tab changed', async () => {
    let fail: (reason: unknown) => void = () => undefined;
    stubHost({
      clear: () =>
        new Promise<BrowserSiteCleared>((_, reject) => {
          fail = reject;
        }),
    });
    renderPane();
    await openPage();
    await confirmClear();
    await waitFor(() => expect(callsOf({ command: 'browser_site_data_clear' })).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    await act(async () => {
      fail({ kind: 'failed', message: 'site-data-unavailable' });
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops the line of a clear that answers after the tab changed', async () => {
    let finish: (value: BrowserSiteCleared) => void = () => undefined;
    stubHost({
      clear: () =>
        new Promise<BrowserSiteCleared>((resolve) => {
          finish = resolve;
        }),
    });
    renderPane();
    await openPage();
    await confirmClear();
    await waitFor(() => expect(callsOf({ command: 'browser_site_data_clear' })).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    await act(async () => {
      finish(cleared({ host: 'localhost', extraHosts: [] }));
    });

    expect(screen.queryByText(/Cleared data/)).toBeNull();
  });

  it('reloads without cache on a shift click of Reload', async () => {
    renderPane();
    await openPage();

    fireEvent.click(reloadButton(), { shiftKey: true });

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_reload_from_origin' })).toEqual([
        ['browser_tab_reload_from_origin', { args: { tabId: 'live-1' } }],
      ]),
    );
  });
});
