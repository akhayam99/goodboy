// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import type { BrowserTab, TabOwner } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { browserTabCount } from '../../browserTabCount';
import type { BrowserTabFacts } from '../../types';
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
  if (studio?.kind !== 'browser') {
    return null;
  }
  return (
    <BrowserStudio sessionId={studio.sessionId} tabId={studio.tabId} onClose={() => undefined} />
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
