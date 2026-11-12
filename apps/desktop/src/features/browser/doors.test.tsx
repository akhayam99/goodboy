// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { MouseEventHandler } from 'react';
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
} from '../../store/storyHarness';
import { mountFixture } from '../../__tests__/helpers/actionFixtures';
import { pressShortcut } from '../../__tests__/helpers/pressKey';
import { registerShortcut } from '../../shared/keyboard/dispatcher';
import { useCommitLinkInterceptor } from '../../shared/hooks/useCommitLinkInterceptor';
import { openUrl } from '../../shared/lib/editor';
import { ToastProvider } from '../../shared/components/Toast';
import type { BrowserTab, TabOwner } from '../../store/slices/browser/types';
import { PortChip } from '../terminal/components/PortChip';
import type { RunnableScript } from '../scripts/buildSessionScripts';
import { ScriptRow } from '../scripts/components/ScriptRow';
import { useBrowserEntries } from '../palette/hooks/useBrowserEntries';
import { browserOpenEntries } from '../palette/sources/browserOpenEntries';
import { browserTabEntries } from '../palette/sources/browserTabEntries';
import { BrowserLinkDoors } from './components/BrowserLinkDoors';
import { BrowserPane } from './components/BrowserPane';
import { claimSessionLink } from './claimSessionLink';
import { useBrowserPane } from './hooks/useBrowserPane';
import { openInBrowser } from './openInBrowser';
import type { BrowserTabFacts } from './types';

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
const OTHER_SESSION_ID = nextSessionId();
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});

type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type SaveArgs = {
  readonly args: {
    readonly id: string;
    readonly owner: TabOwner;
    readonly url: string;
    readonly title: string;
  };
};
type OwnerArgs = { readonly args: { readonly owner: TabOwner } };
type UrlArgs = { readonly url: string };
type CommandParams = { readonly command: string };
type PayloadParams = { readonly payload: unknown };
type RowParams = { readonly id: string; readonly url: string; readonly title: string };
type LinkParams = {
  readonly href: string;
  readonly sessionId: SessionId | null;
  readonly hasLinkArea?: boolean;
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
};

const DEV: RunnableScript = {
  key: 'manifest-dev',
  kind: 'manifest',
  name: 'dev',
  body: 'vite --port 5005',
  invocation: 'pnpm run dev',
  manager: 'pnpm',
  source: 'package-json',
  packageName: 'payments-api',
  relDir: '',
  category: 'dev',
  savedId: null,
};

const SCRIPT_FACTS = {
  name: 'dev',
  command: 'pnpm run dev',
  isRunning: true,
  runBlockedReason: null,
  onShowOutput: vi.fn(),
  onRun: vi.fn(),
  onStop: vi.fn(),
  onEdit: null,
  onDuplicate: null,
  onSaveAs: null,
  onDelete: null,
};

let store: StoryStore;
let rows: BrowserTab[];
let opened: number;
let outside: string[];

const rowOf = ({ id, url, title }: RowParams): BrowserTab => ({
  id,
  sessionId: SESSION_ID,
  projectId: null,
  url,
  title,
  position: rows.length,
  createdAt: 1,
  updatedAt: 1,
});

const stubHost = () => {
  stubStoryInvoke({
    browser_tab_rows_list: ({ args }: OwnerArgs) => {
      const owner = args.owner;
      return owner.kind === 'session'
        ? rows.filter((row) => row.sessionId === owner.sessionId)
        : [];
    },
    browser_tab_row_save: ({ args }: SaveArgs) => {
      const row = rowOf({ id: args.id, url: args.url, title: args.title });
      rows = [...rows.filter((existing) => existing.id !== row.id), row];
      return row;
    },
    browser_tab_open: ({ args }: OpenArgs): BrowserTabFacts => {
      opened += 1;
      return {
        id: `live-${opened}`,
        sessionId: args.sessionId,
        url: args.url,
        title: '',
        isShown: false,
        hiddenSinceMs: null,
        openerId: null,
        isPasskeyBlocked: false,
      };
    },
    browser_tab_list: () => [],
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
    browser_tab_close: null,
    open_url: ({ url }: UrlArgs) => {
      outside = [...outside, url];
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

const renderLink = ({ href, sessionId, hasLinkArea = true, onClick }: LinkParams) => {
  renderHook(() => useCommitLinkInterceptor({ claimLink: claimSessionLink }));
  const anchor = (
    <a href={href} onClick={onClick}>
      checkout
    </a>
  );
  render(
    <>
      {sessionId === null ? (
        anchor
      ) : (
        <div data-browser-session={sessionId}>
          {hasLinkArea ? <div data-browser-links="">{anchor}</div> : anchor}
        </div>
      )}
      <BrowserLinkDoors />
    </>,
  );
  return screen.getByRole('link', { name: 'checkout' });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  rows = [];
  opened = 0;
  outside = [];
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Macintosh');
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    projects: [PAYMENTS_API],
    sessions: [
      buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID }),
      buildStorySession({ id: OTHER_SESSION_ID, workspaceId: WORKSPACE_ID }),
    ],
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id })],
    },
  });
  stubHost();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a server chip', () => {
  it('opens its port beside the session in a new tab', async () => {
    render(<PortChip port={5173} sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open localhost:5173' }));

    await waitFor(() => expect(store.getState().browserActiveTab[SESSION_ID]).toBe('live-1'));
    expect(store.getState().drawer).toEqual({
      kind: 'browser',
      sessionId: SESSION_ID,
      payload: null,
    });
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([
      expect.objectContaining({ sessionId: SESSION_ID, url: 'http://localhost:5173' }),
    ]);
    expect(outside).toEqual([]);
  });

  it('shows the tab already on that server instead of opening another', async () => {
    rows = [
      rowOf({ id: 'tab-docs', url: 'https://docs.harborline.dev/tax', title: 'Tax rates' }),
      rowOf({ id: 'tab-checkout', url: 'http://localhost:5173/checkout', title: 'Checkout' }),
    ];
    render(<PortChip port={5173} sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open localhost:5173' }));

    await waitFor(() => expect(store.getState().browserActiveTab[SESSION_ID]).toBe('tab-checkout'));
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });

  it('hands the port to your own browser on a command click', async () => {
    render(<PortChip port={5173} sessionId={SESSION_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open localhost:5173' }), {
      metaKey: true,
    });

    await waitFor(() => expect(outside).toEqual(['http://localhost:5173']));
    expect(store.getState().drawer).toBeNull();
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });

  it('keeps opening your browser for a terminal with no session', async () => {
    render(<PortChip port={4310} sessionId={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open localhost:4310' }));

    await waitFor(() => expect(outside).toEqual(['http://localhost:4310']));
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });
});

describe('a service row', () => {
  it('opens its live port beside the session the row sits in', async () => {
    render(
      <div data-browser-session={SESSION_ID}>
        <ScriptRow
          script={DEV}
          record={{ status: 'pending', result: null, runId: 'run-dev', startedAt: 1 }}
          now={2}
          isSelected={false}
          blockedReason={null}
          expectedPort={5005}
          portHolder={null}
          facts={{ pid: 4242, ports: [5005], cpuPercent: 1, rssBytes: 1 }}
          target={{ kind: 'script', facts: SCRIPT_FACTS }}
          onOpen={vi.fn()}
          onRun={vi.fn()}
          onStop={vi.fn()}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open localhost:5005' }));

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_open' })).toEqual([
        expect.objectContaining({ sessionId: SESSION_ID, url: 'http://localhost:5005' }),
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open localhost:5005' }), {
      metaKey: true,
    });
    await waitFor(() => expect(outside).toEqual(['http://localhost:5005']));
  });
});

describe('the door', () => {
  it('opens the Browser dock beside a page that covers the session, the page stays', async () => {
    store
      .getState()
      .switchStudio({ studio: { kind: 'terminal', terminalId: null, sessionId: SESSION_ID } });

    await openInBrowser({ sessionId: SESSION_ID, url: 'http://localhost:5173' });

    expect(store.getState().appStudio?.kind).toBe('terminal');
    expect(store.getState().drawer).toEqual({
      kind: 'browser',
      sessionId: SESSION_ID,
      payload: null,
    });
    expect(store.getState().browserActiveTab[SESSION_ID]).toBe('live-1');
  });

  it('keeps the Browser page on the session when it is the page that is open', async () => {
    store
      .getState()
      .switchStudio({ studio: { kind: 'browser', sessionId: SESSION_ID, tabId: null } });

    await openInBrowser({ sessionId: SESSION_ID, url: 'http://localhost:5173' });

    expect(store.getState().appStudio?.kind).toBe('browser');
    expect(store.getState().drawer).toBeNull();
  });

  it('ends the New tab draft when it shows the tab that is already active', async () => {
    rows = [
      rowOf({ id: 'tab-checkout', url: 'http://localhost:5173/checkout', title: 'Checkout' }),
    ];
    store.setState({
      browserSessionTabs: { [SESSION_ID]: rows },
      browserActiveTab: { [SESSION_ID]: 'tab-checkout' },
    });
    const { result } = renderHook(() => useBrowserPane({ sessionId: SESSION_ID }));
    act(() => result.current.startDraft());
    expect(result.current.isDrafting).toBe(true);

    await act(async () => {
      await openInBrowser({ sessionId: SESSION_ID, url: 'http://localhost:5173/checkout' });
    });

    expect(result.current.isDrafting).toBe(false);
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });

  it('ends the New tab draft when it opens a new tab', async () => {
    const { result } = renderHook(() => useBrowserPane({ sessionId: SESSION_ID }));
    act(() => result.current.startDraft());

    await act(async () => {
      await openInBrowser({ sessionId: SESSION_ID, url: 'http://localhost:5173' });
    });

    expect(result.current.isDrafting).toBe(false);
    expect(store.getState().browserActiveTab[SESSION_ID]).toBe('live-1');
  });

  it('lets the last door win while an older open still waits on the host', async () => {
    rows = [rowOf({ id: 'tab-docs', url: 'https://docs.harborline.dev/tax', title: 'Tax rates' })];
    let releaseHost: () => void = () => undefined;
    const hostReply = new Promise<void>((resolve) => {
      releaseHost = resolve;
    });
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
      if (name === 'browser_tab_open') {
        await hostReply;
      }
      return handler?.(name, args);
    });

    const first = openInBrowser({ sessionId: SESSION_ID, url: 'http://localhost:5173' });
    await waitFor(() => expect(callsOf({ command: 'browser_tab_open' })).toHaveLength(1));
    await openInBrowser({ sessionId: SESSION_ID, url: 'https://docs.harborline.dev/tax' });
    releaseHost();
    await first;

    expect(store.getState().browserActiveTab[SESSION_ID]).toBe('tab-docs');
    expect(rows.map((row) => row.id)).toEqual(['tab-docs']);
  });

  it('keeps the old tabs and says so when the host cannot open the page', async () => {
    const reportError = vi.fn(async () => undefined);
    store.setState({ reportError });
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
      if (name === 'browser_tab_open') {
        throw { kind: 'refused', message: 'not-web-address' };
      }
      return handler?.(name, args);
    });

    await openInBrowser({ sessionId: SESSION_ID, url: 'http://localhost:5173' });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't open localhost:5173", sessionId: SESSION_ID }),
    );
    expect(store.getState().browserSessionTabs[SESSION_ID]).toEqual([]);
    expect(rows).toEqual([]);
  });
});

describe('a link', () => {
  it('opens beside its session on a plain click', async () => {
    const link = renderLink({ href: 'http://localhost:5173/checkout', sessionId: SESSION_ID });

    fireEvent.click(link);

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_open' })).toEqual([
        expect.objectContaining({ sessionId: SESSION_ID, url: 'http://localhost:5173/checkout' }),
      ]),
    );
    expect(outside).toEqual([]);
  });

  it('opens your browser on a command click', async () => {
    const link = renderLink({ href: 'https://docs.harborline.dev/tax', sessionId: SESSION_ID });

    fireEvent.click(link, { metaKey: true });

    await waitFor(() => expect(outside).toEqual(['https://docs.harborline.dev/tax']));
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });

  it('opens your browser once on a command click when the anchor handles its own click', async () => {
    const link = renderLink({
      href: 'https://docs.harborline.dev/tax',
      sessionId: SESSION_ID,
      onClick: (event) => {
        event.preventDefault();
        void openUrl('https://docs.harborline.dev/tax');
      },
    });

    fireEvent.click(link, { metaKey: true });

    await waitFor(() => expect(outside).toEqual(['https://docs.harborline.dev/tax']));
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });

  it('keeps a plain click on a session link outside the conversation in your browser', async () => {
    const link = renderLink({
      href: 'http://localhost:5173/checkout',
      sessionId: SESSION_ID,
      hasLinkArea: false,
    });

    fireEvent.click(link);

    await waitFor(() => expect(outside).toEqual(['http://localhost:5173/checkout']));
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
    expect(store.getState().drawer).toBeNull();
  });

  it('leaves a command click on a session link outside the conversation alone', async () => {
    const link = renderLink({
      href: 'https://docs.harborline.dev/tax',
      sessionId: SESSION_ID,
      hasLinkArea: false,
    });

    fireEvent.click(link, { metaKey: true });

    expect(outside).toEqual([]);
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });

  it('keeps opening your browser outside a session', async () => {
    const link = renderLink({ href: 'https://docs.harborline.dev/tax', sessionId: null });

    fireEvent.click(link);

    await waitFor(() => expect(outside).toEqual(['https://docs.harborline.dev/tax']));
    expect(store.getState().drawer).toBeNull();
  });
});

describe('the peek', () => {
  it('names a localhost link and what a click does when the link takes focus', async () => {
    const link = renderLink({ href: 'http://localhost:5173/checkout', sessionId: SESSION_ID });

    fireEvent.focusIn(link);

    const card = await screen.findByTestId('browser-link-peek');
    expect(card.textContent).toContain('localhost:5173');
    expect(card.textContent).toContain('http://localhost:5173/checkout');
    expect(card.textContent).toContain('Opens beside the session. ⌘-click opens your browser.');
  });

  it('shows the title of the tab already on that address after a rest', async () => {
    store.setState({
      browserSessionTabs: {
        [SESSION_ID]: [
          rowOf({ id: 'tab-checkout', url: 'http://localhost:5173/checkout', title: 'Checkout' }),
        ],
      },
    });
    const link = renderLink({ href: 'http://localhost:5173/checkout', sessionId: SESSION_ID });

    fireEvent.pointerOver(link, { pointerType: 'mouse' });

    const card = await screen.findByTestId('browser-link-peek', undefined, { timeout: 2000 });
    expect(card.textContent).toContain('Checkout');
    expect(card.textContent).toContain('Shows its tab beside the session.');
  });

  it('never peeks a link outside the conversation', () => {
    const link = renderLink({
      href: 'http://localhost:5173/checkout',
      sessionId: SESSION_ID,
      hasLinkArea: false,
    });

    fireEvent.focusIn(link);

    expect(screen.queryByTestId('browser-link-peek')).toBeNull();
  });

  it('never peeks a link that is not on this machine', async () => {
    const link = renderLink({ href: 'https://docs.harborline.dev/tax', sessionId: SESSION_ID });

    fireEvent.focusIn(link);

    expect(screen.queryByTestId('browser-link-peek')).toBeNull();
  });
});

describe('command L', () => {
  it('focuses the address of the pane on screen and leaves Ask alone', async () => {
    const ask = vi.fn();
    const release = registerShortcut('ask.open', ask);
    store.getState().openDrawer({ kind: 'browser', sessionId: SESSION_ID, payload: null });
    render(
      <ToastProvider>
        <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
      </ToastProvider>,
    );
    const field = screen.getByRole('textbox', { name: 'Address' });
    field.blur();

    act(() => {
      pressShortcut({ id: 'browser.address' });
    });

    expect(document.activeElement).toBe(field);
    expect(ask).not.toHaveBeenCalled();
    release();
  });

  it('stays Ask while a page covers the pane', () => {
    const ask = vi.fn();
    const release = registerShortcut('ask.open', ask);
    store.getState().switchStudio({ studio: { kind: 'changelog' } });
    render(
      <ToastProvider>
        <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
      </ToastProvider>,
    );

    act(() => {
      pressShortcut({ id: 'ask.open' });
    });

    expect(ask).toHaveBeenCalledTimes(1);
    release();
  });
});

describe('command K', () => {
  it('offers to open a typed address beside the session', async () => {
    const [entry, ...rest] = browserOpenEntries({ query: 'localhost:5173', sessionId: SESSION_ID });

    expect(rest).toEqual([]);
    expect(entry?.label).toBe('Open localhost:5173');
    expect(entry?.detail).toBe('Beside this session');
    entry?.run();

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_open' })).toEqual([
        expect.objectContaining({ sessionId: SESSION_ID, url: 'http://localhost:5173/' }),
      ]),
    );
  });

  it('opens beside the session the palette is scoped to', async () => {
    const { result } = renderHook(() =>
      useBrowserEntries({ query: 'localhost:5173', scopeSessionId: OTHER_SESSION_ID }),
    );

    result.current.opens[0]?.run();

    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_open' })).toEqual([
        expect.objectContaining({ sessionId: OTHER_SESSION_ID, url: 'http://localhost:5173/' }),
      ]),
    );
    expect(store.getState().drawer).toEqual({
      kind: 'browser',
      sessionId: OTHER_SESSION_ID,
      payload: null,
    });
  });

  it('shows the exact tab picked when two tabs share an address', async () => {
    const tabs = [
      rowOf({ id: 'tab-first', url: 'http://localhost:5173/checkout', title: 'Checkout' }),
      rowOf({ id: 'tab-second', url: 'http://localhost:5173/checkout', title: 'Checkout again' }),
    ];
    store.setState({ browserSessionTabs: { [SESSION_ID]: tabs } });
    const entries = browserTabEntries({ sessionId: SESSION_ID, tabs });

    entries[1]?.run();

    expect(store.getState().browserActiveTab[SESSION_ID]).toBe('tab-second');
  });

  it('leaves a word with a dot to the search', () => {
    expect(browserOpenEntries({ query: 'plan.md', sessionId: SESSION_ID })).toEqual([]);
    expect(browserOpenEntries({ query: 'foo.ts:42', sessionId: SESSION_ID })).toEqual([]);
    expect(browserOpenEntries({ query: 'plan.md/x', sessionId: SESSION_ID })).toEqual([]);
    expect(browserOpenEntries({ query: 'checkout total', sessionId: SESSION_ID })).toEqual([]);
  });

  it('lists the session tabs and shows the one picked', async () => {
    const tabs = [
      rowOf({ id: 'tab-checkout', url: 'http://localhost:5173/checkout', title: 'Checkout' }),
      rowOf({ id: 'tab-docs', url: 'https://docs.harborline.dev/tax', title: '' }),
    ];
    store.setState({ browserSessionTabs: { [SESSION_ID]: tabs } });
    const entries = browserTabEntries({ sessionId: SESSION_ID, tabs });

    expect(entries.map((entry) => [entry.label, entry.detail])).toEqual([
      ['Checkout', 'localhost:5173'],
      ['docs.harborline.dev', 'docs.harborline.dev'],
    ]);
    entries[1]?.run();

    expect(store.getState().browserActiveTab[SESSION_ID]).toBe('tab-docs');
    expect(callsOf({ command: 'browser_tab_open' })).toEqual([]);
  });
});
