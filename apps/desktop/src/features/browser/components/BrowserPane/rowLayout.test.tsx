// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
import { ToastProvider } from '../../../../shared/components/Toast';
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
    window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0 }));
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
    onTurn: () => undefined,
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

describe('the browser address row at a narrow pane width', () => {
  it('keeps Pin and Console in the row and Open full page in the head while it is wide', () => {
    stubWidths({ rowWidth: 760 });
    render(
      <ToastProvider>
        <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
      </ToastProvider>,
    );

    expect(document.querySelector('[data-row-folded]')).toBeNull();
    screen.getByRole('button', { name: 'Console' });
    screen.getByRole('button', { name: 'Open full page' });
  });

  it('keeps the address, Console and More in the row under 560px and Open full page and Close in the head', () => {
    stubWidths({ rowWidth: 540 });
    render(
      <ToastProvider>
        <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
      </ToastProvider>,
    );

    expect(document.querySelector('[data-row-folded]')).not.toBeNull();
    screen.getByRole('button', { name: 'Open full page' });
    screen.getByRole('button', { name: 'Console' });
    screen.getByRole('combobox', { name: 'Address or search' });
    screen.getByRole('button', { name: 'Close' });
    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    const menu = screen.getByRole('menu', { name: 'More' });
    within(menu).getByRole('menuitem', { name: /Open full page/ });
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
