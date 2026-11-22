// @vitest-environment happy-dom

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DockCellContext } from '../dockCellContext';
import { DrawerColumn } from '../components/DrawerColumn';
import { DockLane } from '../components/DockLane';
import { DrawerFrame } from '../components/DrawerFrame';
import { DrawerEdgeContext } from '../drawerEdgeContext';
import { DRAWER_PANEL_VARS } from '../drawerPanelVars';
import type { DockGridCell, DockGridSpec } from '../dockGridSpec';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const COLUMN_WIDTH = 1400;
const EDGE_WIDTH = 44;
const LANE = { x: 340, y: 120, width: 960, height: 600 };

const TERMINAL: DockGridCell = { key: 'terminal', sizing: 'side', label: 'Terminal' };
const BROWSER: DockGridCell = { key: 'browser', sizing: 'browser', label: 'Browser' };
const MONITOR: DockGridCell = { key: 'monitoring', sizing: 'reader', label: 'Monitor' };

type LaneParams = {
  readonly width: number;
};

const stubLane = ({ width }: LaneParams) => {
  class Observer {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      const isEdge = target.hasAttribute('data-drawer-edge');
      this.callback([{ contentRect: { width: isEdge ? EDGE_WIDTH : COLUMN_WIDTH } }]);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Observer);
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rectOf(
    this: Element,
  ) {
    if (this.hasAttribute('data-dock-lane')) {
      return new DOMRect(LANE.x, LANE.y, width, LANE.height);
    }
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
  const spec: DockGridSpec = { columns, focus, onFocus, onTurn: vi.fn() };
  return { spec, onFocus };
};

type RenderParams = {
  readonly spec: DockGridSpec;
  readonly detail?: string;
  readonly isDesk?: boolean;
};

const pageOf = ({ isDesk }: Pick<RenderParams, 'isDesk'>) => (
  <div className="flex">
    <ToolRail />
    {isDesk === true ? <DockLane /> : null}
  </div>
);

const renderDesk = ({ spec, detail, isDesk = true }: RenderParams) =>
  render(
    <DrawerColumn
      main={pageOf({ isDesk })}
      drawer={<GridCell />}
      dockGrid={spec}
      detail={detail === undefined ? null : <p>{detail}</p>}
      frame="sheet"
      ariaLabel="Side panel"
      resizeLabel="Resize side panel"
    />,
  );

const aside = () => screen.getByRole('complementary', { name: 'Side panel' });

const grid = () => document.querySelector<HTMLElement>('[data-dock-grid]');

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the dock on the desk', () => {
  it('lays the grid over the lane beside the column, under the head, with the rail kept on the page', () => {
    stubLane({ width: LANE.width });
    const { spec } = specOf({ columns: [[TERMINAL]], focus: 'terminal' });
    renderDesk({ spec });

    expect(aside().hasAttribute('data-drawer-lane')).toBe(true);
    expect(aside().style.left).toBe(`${LANE.x - 12}px`);
    expect(aside().style.top).toBe(`${LANE.y}px`);
    expect(aside().style.width).toBe(`${LANE.width + 12}px`);
    expect(aside().style.height).toBe(`${LANE.height}px`);
    expect(grid()?.style.gridTemplateColumns).toBe(`${LANE.width}px`);
    expect(aside().contains(screen.getByRole('toolbar', { name: 'Tools' }))).toBe(false);
  });

  it('frames a lone tool as a cell, with no handle to drag the lane', () => {
    stubLane({ width: LANE.width });
    const { spec } = specOf({ columns: [[TERMINAL]], focus: 'terminal' });
    renderDesk({ spec });

    const pane = document.querySelector<HTMLElement>('[data-dock-pane="terminal"]');
    expect(pane?.className).toContain('rounded-frame');
    expect(screen.queryByRole('separator', { name: 'Resize side panel' })).toBeNull();
  });

  it('fills the lane with the detail and the grid side by side', () => {
    stubLane({ width: LANE.width });
    const { spec } = specOf({ columns: [[BROWSER], [TERMINAL]], focus: 'browser' });
    renderDesk({ spec, detail: 'Implementer' });

    const detailWidth = Number.parseFloat(aside().style.getPropertyValue(DRAWER_PANEL_VARS.detail));
    const dockWidth = Number.parseFloat(aside().style.getPropertyValue(DRAWER_PANEL_VARS.dock));
    expect(detailWidth + 12 + dockWidth).toBe(LANE.width);
    expect(screen.getByText('Implementer')).toBeTruthy();
  });

  it('shows the tools beyond the second as tabs of one cell, and a tab brings its tool forward', () => {
    stubLane({ width: 880 });
    const { spec, onFocus } = specOf({
      columns: [[BROWSER], [TERMINAL, MONITOR]],
      focus: 'browser',
    });
    renderDesk({ spec, detail: 'Implementer' });

    const tabs = screen.getByRole('tablist', { name: 'Panels' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Terminal', 'Monitor']);
    expect(screen.getByText('terminal body')).toBeTruthy();
    expect(screen.queryByText('monitoring body')).toBeNull();

    fireEvent.click(within(tabs).getByRole('tab', { name: 'Monitor' }));

    expect(onFocus).toHaveBeenCalledWith({ key: 'monitoring' });
  });

  it('lays nothing over the lane while no panel is open', () => {
    stubLane({ width: LANE.width });
    const { spec } = specOf({ columns: [], focus: 'page' });
    render(
      <DrawerColumn
        main={pageOf({ isDesk: true })}
        drawer={null}
        dockGrid={spec}
        detail={null}
        frame="sheet"
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />,
    );

    expect(aside().hasAttribute('data-drawer-lane')).toBe(false);
    expect(aside().style.left).toBe('');
  });

  it('puts the panels back beside the page when the page has no lane', () => {
    stubLane({ width: LANE.width });
    const { spec } = specOf({ columns: [[TERMINAL]], focus: 'terminal' });
    renderDesk({ spec, isDesk: false });

    expect(aside().hasAttribute('data-drawer-lane')).toBe(false);
    expect(aside().contains(screen.getByRole('toolbar', { name: 'Tools' }))).toBe(true);
  });
});
