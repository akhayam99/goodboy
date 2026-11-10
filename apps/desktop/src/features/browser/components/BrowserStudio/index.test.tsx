// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { nextProjectId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryProject,
  buildStorySession,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import type { BrowserTab, TabOwner } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { browserTabCount } from '../../browserTabCount';
import type { BrowserTabFacts } from '../../types';
import { BrowserPane } from '../BrowserPane';
import { BrowserStudio } from './index';

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
const CHECKOUT_SESSION = nextSessionId();
const ROUNDING_SESSION = nextSessionId();
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});
const VIEW_RECT = { x: 320, y: 96, width: 800, height: 720 };
const PANE_RECT = { x: 963, y: 36, width: 477, height: 864 };
const STUDIO_RECT = { x: 248, y: 0, width: 1192, height: 900 };

type RowParams = {
  readonly id: string;
  readonly owner: TabOwner;
  readonly url: string;
  readonly title: string;
  readonly position: number;
};
type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type TabArgs = { readonly args: { readonly tabId: string } };
type OwnerArgs = { readonly args: { readonly owner: TabOwner } };
type RectParams = { readonly element: Element; readonly rect: typeof VIEW_RECT };
type CommandParams = { readonly command: string };
type PayloadParams = { readonly payload: unknown };
type StudioParams = { readonly tabId: string | null; readonly sessionId?: SessionId | null };
type ScopeParams = { readonly scope: string; readonly rect: typeof VIEW_RECT };
type ElementParams = { readonly element: Element };
type ChainParams = { readonly from: Element; readonly to: Element };

let store: StoryStore;
let rows: BrowserTab[];
let live: BrowserTabFacts[];
let opened: number;

const rowOf = ({ id, owner, url, title, position }: RowParams): BrowserTab => ({
  id,
  sessionId: owner.kind === 'session' ? owner.sessionId : null,
  projectId: owner.kind === 'project' ? owner.projectId : null,
  url,
  title,
  position,
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
    browser_tab_open: ({ args }: OpenArgs) => factsOf({ args }),
    browser_tab_list: () => live,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_reload: null,
    browser_tab_passkey_dismiss: ({ args }: TabArgs) => {
      live = live.map((facts) =>
        facts.id === args.tabId ? { ...facts, isPasskeyBlocked: false } : facts,
      );
      return live.find((facts) => facts.id === args.tabId);
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
      throw new Error('The page draws no view placeholder yet.');
    }
    return found;
  });
  giveRect({ element: view, rect: VIEW_RECT });
};

const RoutedBrowser = () => {
  const studio = store((state) => state.appStudio);
  const drawer = store((state) => state.drawer);
  return (
    <>
      {drawer?.kind === 'browser' ? (
        <div data-test-pane="">
          <BrowserPane sessionId={drawer.sessionId} onClose={() => undefined} />
        </div>
      ) : null}
      {studio?.kind === 'browser' ? (
        <div data-studio-slot="content">
          <BrowserStudio
            sessionId={studio.sessionId}
            tabId={studio.tabId}
            onClose={() => undefined}
          />
        </div>
      ) : null}
    </>
  );
};

const openPage = ({ tabId, sessionId = CHECKOUT_SESSION }: StudioParams) => {
  store.getState().switchStudio({ studio: { kind: 'browser', sessionId, tabId } });
  return render(
    <ToastProvider>
      <RoutedBrowser />
    </ToastProvider>,
  );
};

const placeViewIn = async ({ scope, rect }: ScopeParams) => {
  const view = await waitFor(() => {
    const found = document.querySelector(`${scope} [data-browser-view]`);
    if (found === null) {
      throw new Error(`No view placeholder in ${scope} yet.`);
    }
    return found;
  });
  giveRect({ element: view, rect });
};

const classesOf = ({ element }: ElementParams): ReadonlySet<string> =>
  new Set(element.getAttribute('class')?.split(/\s+/) ?? []);

const unsizedBetween = ({ from, to }: ChainParams) => {
  const unsized: string[] = [];
  for (let element: Element = from; element !== to;) {
    const parent = element.parentElement;
    if (parent === null) {
      return [...unsized, 'detached'];
    }
    const own = classesOf({ element });
    const above = classesOf({ element: parent });
    const isFilled = above.has('flex')
      ? !above.has('flex-col') || own.has('flex-1') || own.has('h-full')
      : own.has('h-full');
    if (!isFilled) {
      unsized.push(element.getAttribute('class') ?? element.tagName);
    }
    element = parent;
  }
  return unsized;
};

const lastViewCall = () => {
  const call = storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'browser_tab_show' || name === 'browser_tab_hide')
    .at(-1);
  return call === undefined ? null : [call[0], argsOf({ payload: call[1] })['tabId']];
};

const openPane = async () => {
  store.getState().openDrawer({ kind: 'browser', sessionId: CHECKOUT_SESSION, payload: null });
  render(
    <ToastProvider>
      <RoutedBrowser />
    </ToastProvider>,
  );
  await placeViewIn({ scope: '[data-test-pane]', rect: PANE_RECT });
  await waitFor(() => expect(lastViewCall()).toEqual(['browser_tab_show', 'live-1']));
};

const promote = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Open as page' }));
  const slot = await waitFor(() => {
    const found = document.querySelector('[data-studio-slot]');
    if (found === null) {
      throw new Error('The page did not open.');
    }
    return found;
  });
  giveRect({ element: slot, rect: STUDIO_RECT });
  await placeViewIn({ scope: '[data-studio-slot]', rect: VIEW_RECT });
};

const failPagePlace = () => {
  const handler = storySpies.tauriInvoke.getMockImplementation();
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    const bounds = argsOf({ payload: args })['bounds'];
    const isPage =
      typeof bounds === 'object' && bounds !== null && Reflect.get(bounds, 'x') === VIEW_RECT.x;
    if (name === 'browser_tab_place' && isPage) {
      throw { kind: 'refused', message: 'other-window' };
    }
    return handler?.(name, args);
  });
};

const holdNextShow = () => {
  let release: () => void = () => undefined;
  let isHeld = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = storySpies.tauriInvoke.getMockImplementation();
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    if (name === 'browser_tab_show' && !isHeld) {
      isHeld = true;
      await gate;
    }
    return handler?.(name, args);
  });
  return { release: () => release() };
};

const expectNoReload = () => {
  expect(callsOf({ command: 'browser_tab_open' })).toHaveLength(1);
  expect(callsOf({ command: 'browser_tab_navigate' })).toEqual([]);
  expect(callsOf({ command: 'browser_tab_reload' })).toEqual([]);
};

const groupLabels = (): ReadonlyArray<string | null> =>
  Array.from(document.querySelectorAll('[data-browser-group]')).map((group) =>
    group.getAttribute('aria-label'),
  );

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  live = [];
  opened = 0;
  rows = [
    rowOf({
      id: 'tab-checkout',
      owner: { kind: 'session', sessionId: CHECKOUT_SESSION },
      url: 'http://localhost:5173/checkout',
      title: 'Checkout',
      position: 0,
    }),
    rowOf({
      id: 'tab-tax',
      owner: { kind: 'session', sessionId: CHECKOUT_SESSION },
      url: 'https://docs.harborline.dev/tax',
      title: 'Tax rates',
      position: 1,
    }),
    rowOf({
      id: 'tab-pr',
      owner: { kind: 'session', sessionId: ROUNDING_SESSION },
      url: 'https://git.northwind.dev/ledger-core/pull/318',
      title: 'PR #318',
      position: 0,
    }),
    rowOf({
      id: 'pin-guides',
      owner: { kind: 'project', projectId: PAYMENTS_API.id },
      url: 'https://docs.acme.dev/payments-api',
      title: 'API guides',
      position: 0,
    }),
  ];
  await resetStoryStore();
  await openStorySqlite();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [
      buildStorySession({
        id: CHECKOUT_SESSION,
        workspaceId: WORKSPACE_ID,
        goal: 'Show tax in the checkout total',
      }),
      buildStorySession({
        id: ROUNDING_SESSION,
        workspaceId: WORKSPACE_ID,
        goal: 'Fix the rounding drift',
      }),
    ],
    sessionProjectMounts: {
      [CHECKOUT_SESSION]: [
        mountFixture({ sessionId: CHECKOUT_SESSION, projectId: PAYMENTS_API.id }),
      ],
    },
  });
  stubHost();
});

afterEach(() => {
  cleanup();
});

describe('the browser page', () => {
  it('lists every tab grouped by session, then the pins of the project', async () => {
    openPage({ tabId: null });

    await waitFor(() =>
      expect(groupLabels()).toEqual([
        'Show tax in the checkout total',
        'Fix the rounding drift',
        'Pinned for payments-api',
      ]),
    );
    const checkout = screen.getByRole('region', { name: 'Show tax in the checkout total' });
    expect(
      Array.from(checkout.querySelectorAll('[aria-current], button[aria-label]')).map((row) =>
        row.getAttribute('aria-label'),
      ),
    ).toEqual(expect.arrayContaining(['Checkout', 'Tax rates']));
    screen.getByRole('button', { name: 'PR #318' });
    screen.getByRole('button', { name: 'API guides, pinned' });
    screen.getByRole('heading', { name: 'Browser' });
  });

  it('shows the first tab of the session it opened for, in the native view over the page', async () => {
    openPage({ tabId: null });
    await placeView();

    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([
      expect.objectContaining({
        sessionId: CHECKOUT_SESSION,
        url: 'http://localhost:5173/checkout',
        isShown: false,
      }),
    ]);
    expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      tabId: 'live-1',
      bounds: VIEW_RECT,
    });
    expect(store.getState().appStudio).toEqual({
      kind: 'browser',
      sessionId: CHECKOUT_SESSION,
      tabId: 'tab-checkout',
    });
  });

  it('gives the native view the full height of the page, with no stand-in to prop it open', async () => {
    openPage({ tabId: null });
    const view = await waitFor(() => {
      const found = document.querySelector('[data-browser-view]');
      if (found === null) {
        throw new Error('The page draws no view placeholder yet.');
      }
      return found;
    });
    const layout = document.querySelector('[data-studio-rail="page"]');

    expect(layout).not.toBeNull();
    expect(unsizedBetween({ from: view, to: layout?.parentElement ?? view })).toEqual([]);

    giveRect({ element: view, rect: VIEW_RECT });
    await waitFor(() => expect(lastViewCall()).toEqual(['browser_tab_show', 'live-1']));
    expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      tabId: 'live-1',
      bounds: VIEW_RECT,
    });
  });

  it('says on the page when the shown tab asked for a passkey, and dismisses it for that tab', async () => {
    openPage({ tabId: null });
    await placeView();
    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));

    live = live.map((facts) => ({ ...facts, isPasskeyBlocked: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    const notice = await screen.findByText("Passkeys don't work in Goodboy's browser");
    const region = notice.closest('[role="status"]');
    if (!(region instanceof HTMLElement)) {
      throw new Error('The passkey notice has no status region.');
    }
    fireEvent.click(within(region).getByRole('button', { name: 'Dismiss' }));

    await waitFor(() =>
      expect(screen.queryByText("Passkeys don't work in Goodboy's browser")).toBeNull(),
    );
    expect(callsOf({ command: 'browser_tab_passkey_dismiss' })).toEqual([{ tabId: 'live-1' }]);
  });

  it('opens a tab of another session in place and names it in the route', async () => {
    openPage({ tabId: null });
    fireEvent.click(await screen.findByRole('button', { name: 'PR #318' }));

    expect(store.getState().appStudio).toEqual({
      kind: 'browser',
      sessionId: ROUNDING_SESSION,
      tabId: 'tab-pr',
    });
    await placeView();
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_open' }).at(-1)).toEqual(
        expect.objectContaining({
          sessionId: ROUNDING_SESSION,
          url: 'https://git.northwind.dev/ledger-core/pull/318',
        }),
      ),
    );
    expect(screen.getByRole('button', { name: 'PR #318' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('comes back to the tab the route names, not the first one, after a reload', async () => {
    openPage({ tabId: 'tab-tax' });
    await placeView();

    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([
      expect.objectContaining({ url: 'https://docs.harborline.dev/tax' }),
    ]);
    expect(store.getState().browserActiveTab[CHECKOUT_SESSION]).toBe('tab-tax');
    expect(store.getState().appStudio).toEqual({
      kind: 'browser',
      sessionId: CHECKOUT_SESSION,
      tabId: 'tab-tax',
    });
  });

  it('hides the native view while a menu covers it and shows it again after', async () => {
    openPage({ tabId: null });
    await placeView();
    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    giveRect({ element: menu, rect: { x: 900, y: 120, width: 240, height: 200 } });
    document.body.append(menu);

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_hide' })).toEqual([{ tabId: 'live-1' }]),
    );

    menu.remove();
    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(2));
  });

  it('lists and loads only the sessions of the open workspace, and the tile counts the same rows', async () => {
    const elsewhere = nextSessionId();
    rows = [
      ...rows,
      rowOf({
        id: 'tab-cascadia',
        owner: { kind: 'session', sessionId: elsewhere },
        url: 'https://status.cascadia.dev',
        title: 'Status',
        position: 0,
      }),
    ];
    store.setState({
      sessions: [
        ...store.getState().sessions,
        buildStorySession({
          id: elsewhere,
          workspaceId: nextWorkspaceId(),
          goal: 'Watch the notify-relay queue',
        }),
      ],
    });
    openPage({ tabId: null });

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', {
          name: /^(Checkout|Tax rates|PR #318|API guides, pinned)$/,
        }),
      ).toHaveLength(4),
    );
    expect(groupLabels()).not.toContain('Watch the notify-relay queue');
    expect(
      callsOf({ command: 'browser_tab_rows_list' }).map((args) => args.owner),
    ).not.toContainEqual({ kind: 'session', sessionId: elsewhere });
    expect(browserTabCount({ state: store.getState() })).toBe(4);
  });

  it('opens on the first session holding a tab when the route names no session', async () => {
    openPage({ tabId: 'tab-pr', sessionId: null });
    await placeView();

    await waitFor(() =>
      expect(store.getState().appStudio).toEqual({
        kind: 'browser',
        sessionId: CHECKOUT_SESSION,
        tabId: 'tab-checkout',
      }),
    );
    expect(screen.getByRole('button', { name: 'Checkout' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('opens on a session that hosts a pin when no session holds a tab', async () => {
    rows = rows.filter((row) => row.projectId !== null);
    openPage({ tabId: null, sessionId: null });

    await waitFor(() =>
      expect(groupLabels()).toEqual(['Show tax in the checkout total', 'Pinned for payments-api']),
    );
    expect(screen.queryByText('No browser tabs yet')).toBeNull();
    screen.getByRole('button', { name: 'API guides, pinned' });
  });

  it('says there is nothing yet when no session has a tab', async () => {
    rows = [];
    store.setState({ sessions: [] });
    openPage({ tabId: null });

    expect(await screen.findByText('No browser tabs yet')).toBeDefined();
    expect(document.querySelector('[data-browser-view]')).toBeNull();
  });
});

describe('moving a tab between the pane and the page', () => {
  it('opens the shown tab as a page with the same live view and no reload', async () => {
    await openPane();
    await promote();

    expect(store.getState().appStudio).toEqual({
      kind: 'browser',
      sessionId: CHECKOUT_SESSION,
      tabId: 'tab-checkout',
    });
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
        tabId: 'live-1',
        bounds: VIEW_RECT,
      }),
    );
    await waitFor(() => expect(lastViewCall()).toEqual(['browser_tab_show', 'live-1']));
    expectNoReload();
  });

  it('puts the tab back beside the session with the same live view and no reload', async () => {
    await openPane();
    await promote();
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
        tabId: 'live-1',
        bounds: VIEW_RECT,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back beside the session' }));

    expect(store.getState().appStudio).toBeNull();
    expect(store.getState().drawer).toEqual({
      kind: 'browser',
      sessionId: CHECKOUT_SESSION,
      payload: null,
    });
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
        tabId: 'live-1',
        bounds: PANE_RECT,
      }),
    );
    await waitFor(() => expect(lastViewCall()).toEqual(['browser_tab_show', 'live-1']));
    expectNoReload();
  });

  it('shows the error on the page and leaves the view to the pane when the page cannot place it', async () => {
    await openPane();
    failPagePlace();
    await promote();

    const page = document.querySelector('[data-studio-slot]');
    await waitFor(() =>
      expect(page?.querySelector('[role="alert"]')?.textContent).toBe(
        'This tab is open in another window.',
      ),
    );
    expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Back beside the session' }));

    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(2));
    expect(lastViewCall()).toEqual(['browser_tab_show', 'live-1']);
    expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
      tabId: 'live-1',
      bounds: PANE_RECT,
    });
    expectNoReload();
  });

  it('drops a page show that answers after the tab went back beside the session', async () => {
    await openPane();
    const held = holdNextShow();
    await promote();
    await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: 'Back beside the session' }));
    await act(async () => {
      held.release();
    });

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
        tabId: 'live-1',
        bounds: PANE_RECT,
      }),
    );
    await waitFor(() => expect(lastViewCall()).toEqual(['browser_tab_show', 'live-1']));
    const viewCalls = storySpies.tauriInvoke.mock.calls
      .map(([name]) => name)
      .filter((name) => name === 'browser_tab_show' || name === 'browser_tab_hide');
    expect(viewCalls.slice(-2)).toEqual(['browser_tab_hide', 'browser_tab_show']);
    expectNoReload();
  });
});
