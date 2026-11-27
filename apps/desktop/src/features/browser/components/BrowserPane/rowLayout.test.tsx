// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import { AppShell, DockCellContext, DrawerFrame, type DockGridSpec } from '@goodboy/ui';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { BrowserTab } from '../../../../store/slices/browser/types';
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
const WIDE_PX = 2600;

const PANE_RECTS: Readonly<Record<string, DOMRect>> = {
  terminal: new DOMRect(0, 0, 600, 800),
  browser: new DOMRect(612, 0, 600, 800),
};

type ObserverCallback = (
  entries: ReadonlyArray<{ readonly target: Element; readonly contentRect: { width: number } }>,
) => void;

type WidthParams = {
  readonly rowWidth: number;
};

type PointerParams = {
  readonly type: string;
  readonly x: number;
  readonly y: number;
};

let store: StoryStore;

const stubWidths = ({ rowWidth }: WidthParams) => {
  class StubObserver {
    private readonly callback: ObserverCallback;

    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      const width = target.hasAttribute('data-grid-row') ? rowWidth : WIDE_PX;
      this.callback([{ target, contentRect: { width } }]);
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
};

const stubPaneRects = () => {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    const key = this.getAttribute('data-dock-pane');
    return key === null ? original.call(this) : (PANE_RECTS[key] ?? original.call(this));
  });
};

const pointer = ({ type, x, y }: PointerParams) => {
  act(() => {
    window.dispatchEvent(
      new MouseEvent(type, {
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
      }),
    );
  });
};

const nextFrame = async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
};

const DeskCell = () => {
  const key = useContext(DockCellContext);
  if (key === 'browser') {
    return <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />;
  }
  return (
    <DrawerFrame title="Terminal" onClose={() => undefined}>
      <p>ledger-core</p>
    </DrawerFrame>
  );
};

const renderDesk = () => {
  const onMove = vi.fn();
  const dockGrid: DockGridSpec = {
    columns: [[{ key: 'terminal', sizing: 'side' }], [{ key: 'browser', sizing: 'browser' }]],
    focus: 'browser',
    onFocus: () => undefined,
    onMove,
  };
  render(
    <ToastProvider>
      <AppShell
        leftRail={<nav aria-label="Places" />}
        main={<div data-drawer-main="">Overview of Harborline</div>}
        drawer={<DeskCell />}
        dockGrid={dockGrid}
      />
    </ToastProvider>,
  );
  return { onMove };
};

const browserHeadOf = (): HTMLElement => {
  const head = document.querySelector<HTMLElement>(
    '[data-dock-pane="browser"] [data-dock-panel-head][data-dock-drag-source]',
  );
  if (head === null) {
    throw new Error('The browser head is not a drag source.');
  }
  return head;
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
  });
  stubStoryInvoke({
    browser_tab_rows_list: [],
    browser_workspace_tab_rows_list: [],
    browser_tab_list: [],
    browser_visits_list: [],
    browser_history_state: null,
    browser_console_read: { doc: null, entries: [], watermark: 0, isHeard: false },
    browser_favicon: null,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const TAB_TITLES = ['Checkout', 'Tax rates', 'Ledger entries'];

type IndexParams = {
  readonly index: number;
};

const tabRowOf = ({ index }: IndexParams): BrowserTab => ({
  id: `row-${index}`,
  sessionId: SESSION_ID,
  projectId: null,
  url: `http://localhost:5173/page-${index}`,
  title: TAB_TITLES[index] ?? 'Harborline',
  position: index,
  createdAt: 1,
  updatedAt: 1,
});

const tabFactsOf = ({ index }: IndexParams): BrowserTabFacts => ({
  id: `live-${index}`,
  sessionId: SESSION_ID,
  url: `http://localhost:5173/page-${index}`,
  title: TAB_TITLES[index] ?? 'Harborline',
  state: 'live',
  isShown: index === 0,
  hiddenSinceMs: null,
  openerId: null,
  isPasskeyBlocked: false,
});

const seedTabs = () => {
  const rows = TAB_TITLES.map((_, index) => tabRowOf({ index }));
  const live = TAB_TITLES.map((_, index) => tabFactsOf({ index }));
  store.setState({
    browserSessionTabs: { [SESSION_ID]: rows },
    browserActiveTab: { [SESSION_ID]: 'row-0' },
    browserShownPin: { [SESSION_ID]: null },
    browserLiveTabs: {
      [SESSION_ID]: Object.fromEntries(rows.map((row, index) => [row.id, `live-${index}`])),
    },
  });
  stubStoryInvoke({
    browser_tab_rows_list: () => rows,
    browser_workspace_tab_rows_list: () => rows,
    browser_tab_list: () => live,
    browser_visits_list: [],
    browser_history_state: null,
    browser_console_read: { doc: null, entries: [], watermark: 0, isHeard: false },
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: () => live[0],
    browser_tab_hide: () => live[0],
  });
};

const renderBrowserPane = () =>
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );

const browserRow = (): HTMLElement => {
  const row = document.querySelector<HTMLElement>('[data-browser-row]');
  if (row === null) {
    throw new Error('The pane draws no browser row.');
  }
  return row;
};

describe('the browser address row at a narrow pane width', () => {
  it('keeps six fixed controls at rest and Open full page in the head only', async () => {
    stubWidths({ rowWidth: 760 });
    seedTabs();
    renderBrowserPane();
    await screen.findByRole('button', { name: /^Edit address, Checkout/ });

    expect(document.querySelector('[data-row-narrow]')).toBeNull();
    const row = within(browserRow());
    ['Back', 'Forward', 'Reload', 'New tab', 'Select an element', 'Console'].forEach((name) =>
      row.getByRole('button', { name }),
    );
    expect(row.queryByRole('button', { name: /^(Pin to|Unpin from) / })).toBeNull();
    expect(row.queryByRole('button', { name: /^Show \d+ errors?$/ })).toBeNull();
    expect(row.queryByRole('button', { name: 'More' })).toBeNull();
    expect(row.queryByRole('button', { name: 'Open full page' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Open full page' })).toHaveLength(1);
    row.getByRole('button', { name: /^Tax rates/ });
  });

  it('opens the page menu from the keyboard and hides it while the address is edited', async () => {
    stubWidths({ rowWidth: 760 });
    seedTabs();
    renderBrowserPane();
    const user = userEvent.setup();
    const chevron = await screen.findByRole('button', { name: 'Page menu' });

    expect(chevron.getAttribute('aria-haspopup')).toBe('menu');
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    chevron.focus();
    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', { name: 'Page menu' });
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Page menu' })).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /^Edit address, Checkout/ }));

    screen.getByRole('combobox', { name: 'Address or search' });
    expect(screen.queryByRole('button', { name: 'Page menu' })).toBeNull();
  });

  it('keeps the shown tab and New tab in the row under 560px and lists the other tabs in the page menu', async () => {
    stubWidths({ rowWidth: 540 });
    seedTabs();
    renderBrowserPane();
    await screen.findByRole('button', { name: /^Edit address, Checkout/ });

    expect(document.querySelector('[data-row-narrow]')).not.toBeNull();
    const row = within(browserRow());
    row.getByRole('button', { name: 'New tab' });
    row.getByRole('button', { name: 'Console' });
    expect(row.queryByRole('button', { name: /^Tax rates/ })).toBeNull();
    screen.getByRole('button', { name: 'Open full page' });
    screen.getByRole('button', { name: 'Close' });
    fireEvent.click(row.getByRole('button', { name: 'Page menu' }));

    const menu = screen.getByRole('menu', { name: 'Page menu' });
    const tabs = within(menu).getByRole('group', { name: 'Tabs' });
    expect(
      within(tabs)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Tax rates', 'Ledger entries']);
    expect(within(menu).queryByRole('menuitem', { name: /Open full page/ })).toBeNull();
    fireEvent.click(within(tabs).getByRole('menuitem', { name: 'Tax rates' }));

    expect(store.getState().browserActiveTab[SESSION_ID]).toBe('row-1');
  });

  it('keeps every tab chip in the narrow row while a new tab has no address', async () => {
    stubWidths({ rowWidth: 540 });
    seedTabs();
    renderBrowserPane();
    await screen.findByRole('button', { name: /^Edit address, Checkout/ });
    const row = within(browserRow());

    fireEvent.click(row.getByRole('button', { name: 'New tab' }));

    row.getByRole('combobox', { name: 'Address or search' });
    TAB_TITLES.forEach((title) => row.getByRole('button', { name: new RegExp(`^${title}`) }));
    fireEvent.click(row.getByRole('button', { name: /^Tax rates/ }));

    await screen.findByRole('button', { name: /^Edit address, Tax rates/ });
    expect(row.queryByRole('button', { name: /^Checkout/ })).toBeNull();
  });
});

describe('moving the browser pane in the desk', () => {
  it('drags the pane by its head like any other pane and drops it above the terminal', async () => {
    stubWidths({ rowWidth: 600 });
    stubPaneRects();
    const { onMove } = renderDesk();

    expect(document.querySelector('[data-dock-pane="browser"] [data-dock-grip]')).toBeNull();
    fireEvent.pointerDown(browserHeadOf(), { clientX: 700, clientY: 20, button: 0 });
    pointer({ type: 'pointermove', x: 200, y: 50 });
    await nextFrame();
    pointer({ type: 'pointerup', x: 200, y: 50 });

    expect(onMove).toHaveBeenCalledWith({
      key: 'browser',
      unit: 'cell',
      target: { at: 'above', key: 'terminal' },
    });
  });

  it('starts no drag from a control of the head', async () => {
    stubWidths({ rowWidth: 600 });
    stubPaneRects();
    const { onMove } = renderDesk();

    const close = within(browserHeadOf()).getByRole('button', { name: 'Close' });
    fireEvent.pointerDown(close, { clientX: 700, clientY: 20, button: 0 });
    pointer({ type: 'pointermove', x: 200, y: 50 });
    await nextFrame();
    pointer({ type: 'pointerup', x: 200, y: 50 });

    expect(onMove).not.toHaveBeenCalled();
  });
});
