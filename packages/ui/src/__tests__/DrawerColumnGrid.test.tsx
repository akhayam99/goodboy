// @vitest-environment happy-dom

import { useContext } from 'react';
import { DockCellContext } from '../dockCellContext';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrawerColumn } from '../components/DrawerColumn';
import { DrawerFrame } from '../components/DrawerFrame';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import type { DockGridCell, DockGridSpec } from '../dockGridSpec';
import { BROWSER_DRAWER_STORAGE_KEY, RIGHT_DRAWER_STORAGE_KEY } from '../drawerWidthKeys';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const EDGE_WIDTH = 44;

const TERMINAL: DockGridCell = { key: 'terminal', sizing: 'side' };

const BROWSER: DockGridCell = { key: 'browser', sizing: 'browser' };

type ColumnParams = {
  readonly column: number;
};

const stubColumn = ({ column }: ColumnParams) => {
  class Observer {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      const isEdge = target.hasAttribute('data-drawer-edge');
      this.callback([{ contentRect: { width: isEdge ? EDGE_WIDTH : column } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Observer);
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    const rect = original.call(this);
    return this.hasAttribute('data-drawer-edge') && this.childElementCount > 0
      ? new DOMRect(rect.x, rect.y, EDGE_WIDTH, rect.height)
      : rect;
  });
};

const ToolRail = () => {
  const host = useContext(DrawerEdgeContext);
  const rail = (
    <div role="toolbar" aria-label="Tools">
      <button type="button">Terminal</button>
    </div>
  );
  return host === null ? rail : createPortal(rail, host);
};

const GridCell = () => {
  const key = useContext(DockCellContext) ?? 'none';
  return (
    <DrawerFrame title={key} onClose={() => undefined}>
      <p>{`${key} body`}</p>
    </DrawerFrame>
  );
};

type SpecParams = {
  readonly columns: DockGridSpec['columns'];
  readonly focus: string;
};

const specOf = ({ columns, focus }: SpecParams) => {
  const onFocus = vi.fn();
  const onTurn = vi.fn();
  const spec: DockGridSpec = {
    columns,
    focus,
    onFocus,
    onTurn,
  };
  return { spec, onFocus, onTurn };
};

type RenderParams = {
  readonly spec: DockGridSpec;
  readonly detail?: string;
};

const renderGrid = ({ spec, detail }: RenderParams) =>
  render(
    <DrawerColumn
      main={<ToolRail />}
      drawer={<GridCell />}
      dockGrid={spec}
      detail={detail === undefined ? null : <p>{detail}</p>}
      frame="sheet"
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

const panes = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-dock-pane]'));

const grid = () => document.querySelector<HTMLElement>('[data-dock-grid]');

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DrawerColumn dock grid', () => {
  it('lays two tools side by side left of the rail, which stays last on the window edge', () => {
    stubColumn({ column: 2600 });
    const { spec } = specOf({ columns: [[TERMINAL], [BROWSER]], focus: 'browser' });
    renderGrid({ spec });

    expect(panes().map((pane) => pane.dataset.dockPane)).toEqual(['terminal', 'browser']);
    expect(grid()?.style.gridTemplateColumns).toBe('400px 12px 720px');
    const box = document.querySelector('[data-container="drawer"]');
    const rail = screen.getByRole('toolbar', { name: 'Tools' });
    expect(box?.lastElementChild?.contains(rail)).toBe(true);
    expect(panes().every((pane) => box?.contains(pane) === true)).toBe(true);
    expect((grid()!.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(
      true,
    );
    expect(screen.getByRole('complementary', { name: 'Side panel' }).style.width).toBe(
      `${400 + 12 + 720 + EDGE_WIDTH + 12}px`,
    );
  });

  it('stacks the pair in one column when the page would lose its minimum side by side', () => {
    stubColumn({ column: 1300 });
    const { spec } = specOf({ columns: [[TERMINAL], [BROWSER]], focus: 'browser' });
    renderGrid({ spec });

    expect(grid()?.style.gridTemplateColumns).toBe('632px');
    expect(grid()?.style.gridTemplateRows).toContain('12px');
    expect(panes().map((pane) => pane.style.gridRow)).toEqual(['1', '3']);
    expect(screen.queryByRole('button', { name: 'Stack the panels' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Put the panels side by side' })).toBeNull();
  });

  it('tints the border of the focused panel only', () => {
    stubColumn({ column: 2600 });
    const { spec } = specOf({ columns: [[TERMINAL], [BROWSER]], focus: 'browser' });
    renderGrid({ spec });

    const [terminal, browser] = panes();
    expect(browser?.hasAttribute('data-panel-focused')).toBe(true);
    expect(browser?.className).toContain('border-focus-ring');
    expect(terminal?.hasAttribute('data-panel-focused')).toBe(false);
    expect(terminal?.className).toContain('border-frame-edge');
  });

  it('names the page or the panel a click lands in', () => {
    stubColumn({ column: 2600 });
    const { spec, onFocus } = specOf({ columns: [[TERMINAL], [BROWSER]], focus: 'browser' });
    const { container } = renderGrid({ spec });
    onFocus.mockClear();

    fireEvent.pointerDown(screen.getByText('terminal body'));
    fireEvent.pointerDown(container.querySelector('[data-drawer-main]')!);

    expect(onFocus.mock.calls.map(([params]) => params)).toEqual([
      { key: 'terminal' },
      { key: 'page' },
    ]);
  });

  it('turns the pair from its head when both shapes fit, naming the panel it came from', () => {
    stubColumn({ column: 2600 });
    const { spec, onTurn } = specOf({ columns: [[TERMINAL], [BROWSER]], focus: 'browser' });
    renderGrid({ spec });

    const turns = screen.getAllByRole('button', { name: 'Stack the panels' });
    expect(turns).toHaveLength(2);
    fireEvent.click(turns[0]!);

    expect(onTurn).toHaveBeenCalledWith({ key: 'terminal' });
  });

  it('offers side by side for a stacked pair with room for both', () => {
    stubColumn({ column: 2600 });
    const { spec } = specOf({ columns: [[TERMINAL, BROWSER]], focus: 'terminal' });
    renderGrid({ spec });

    expect(screen.getAllByRole('button', { name: 'Put the panels side by side' })).toHaveLength(2);
  });

  it('draws one tool as before, in the dock card, with no tint and no turn', () => {
    stubColumn({ column: 2600 });
    const { spec } = specOf({ columns: [[TERMINAL]], focus: 'terminal' });
    renderGrid({ spec });

    const [terminal] = panes();
    expect(terminal?.className).not.toContain('border');
    expect(document.querySelector('[data-panel-focused]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stack the panels' })).toBeNull();
  });

  it('tints the detail when it and a tool share the frame and the detail has focus', () => {
    stubColumn({ column: 2600 });
    const { spec } = specOf({ columns: [[TERMINAL]], focus: 'detail' });
    renderGrid({ spec, detail: 'Plan for payments-api' });

    const detail = document.querySelector('[data-container="detail"]');
    expect(detail?.hasAttribute('data-panel-focused')).toBe(true);
    expect(detail?.className).toContain('border-focus-ring');
  });
});

describe('DrawerColumn dock grid widths saved on the session', () => {
  it('sizes each column from the width the session saved', () => {
    stubColumn({ column: 2600 });
    const { spec } = specOf({
      columns: [[{ ...TERMINAL, savedWidth: 460 }], [{ ...BROWSER, savedWidth: 800 }]],
      focus: 'browser',
    });
    renderGrid({ spec });

    expect(grid()?.style.gridTemplateColumns).toBe('460px 12px 800px');
  });

  it('starts a column with no saved width at its tier default, not at the old shared key', () => {
    localStorage.setItem(BROWSER_DRAWER_STORAGE_KEY, '840');
    stubColumn({ column: 2600 });
    const { spec } = specOf({ columns: [[TERMINAL], [BROWSER]], focus: 'browser' });
    renderGrid({ spec });

    expect(grid()?.style.gridTemplateColumns).toBe('400px 12px 720px');
  });

  it('never starts a tool column at the width a detail panel was dragged to', () => {
    stubColumn({ column: 2600 });
    const { spec } = specOf({ columns: [[TERMINAL]], focus: 'terminal' });
    const view = renderGrid({ spec, detail: 'Ask' });

    const detailHandle = screen.getByRole('separator', { name: 'Resize detail panel' });
    fireEvent.keyDown(detailHandle, { key: 'ArrowLeft' });
    fireEvent.keyDown(detailHandle, { key: 'ArrowLeft' });
    view.unmount();
    renderGrid({ spec });

    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBeNull();
    expect(
      screen.getByRole('separator', { name: 'Resize side panel' }).getAttribute('aria-valuenow'),
    ).toBe('400');
  });

  it('hands a resized column to the session by the panel that sets its width', () => {
    stubColumn({ column: 2600 });
    const onResize = vi.fn();
    const { spec } = specOf({ columns: [[TERMINAL], [BROWSER]], focus: 'browser' });
    renderGrid({ spec: { ...spec, onResize } });

    const handle = screen.getByRole('separator', { name: 'Resize side panel 2' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.doubleClick(handle);

    expect(onResize.mock.calls.map(([params]) => params)).toEqual([
      { key: 'browser', width: 728 },
      { key: 'browser', width: 720 },
    ]);
    expect(localStorage.getItem(BROWSER_DRAWER_STORAGE_KEY)).toBeNull();
  });

  it('hands the width of a single tool to the session too', () => {
    stubColumn({ column: 2600 });
    const onResize = vi.fn();
    const { spec } = specOf({ columns: [[{ ...TERMINAL, savedWidth: 460 }]], focus: 'terminal' });
    renderGrid({ spec: { ...spec, onResize } });

    const handle = screen.getByRole('separator', { name: 'Resize side panel' });
    expect(handle.getAttribute('aria-valuenow')).toBe('460');
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });

    expect(onResize).toHaveBeenCalledWith({ key: 'terminal', width: 468 });
    expect(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY)).toBeNull();
  });
});
